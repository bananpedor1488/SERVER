import AVFoundation
import Combine
import Foundation

class AudioPlayer: ObservableObject {
    private var player: AVPlayer?
    private var timeObserverToken: Any?
    private var currentURL: URL?
    
    @Published var currentTime: Double = 0
    @Published var duration: Double = 0
    @Published var isPlaying: Bool = false
    @Published var isAudioLoaded: Bool = false
    
    private var cancellables = Set<AnyCancellable>()
    private let api = APIClient()
    
    private var sessionId: String {
        let key = "weeky-session-id"
        if let existing = UserDefaults.standard.string(forKey: key), existing.count > 6 {
            return existing
        }
        let sid = UUID().uuidString
        UserDefaults.standard.set(sid, forKey: key)
        return sid
    }

    func loadAudio(from trackId: String, type: String = "sc") {
        print("AudioPlayer: Loading track \(trackId) type: \(type)")
        
        // First, send play command to server
        Task { @MainActor in
            await sendPlayCommand(trackId: trackId, type: type)
        }
        
        // Then get stream URL
        getStreamURL()
    }
    
    private func sendPlayCommand(trackId: String, type: String) async {
        struct PlayResponse: Codable {
            let success: Bool
            let error: String?
        }
        
        do {
            let body = try JSONSerialization.data(withJSONObject: [
                "track": ["id": trackId],
                "queue": [["id": trackId]],
                "index": 0
            ], options: [])
            
            let _: PlayResponse = try await api.requestJSON(
                "/api/player/play",
                method: "POST",
                body: body,
                decode: PlayResponse.self
            )
            
            print("AudioPlayer: Play command sent")
        } catch {
            print("AudioPlayer: Play command error - \(error)")
        }
    }
    
    private func getStreamURL() {
        Task { @MainActor in
            struct StreamResponse: Codable {
                let success: Bool
                let streamUrl: String?
                let error: String?
            }
            
            do {
                let response: StreamResponse = try await api.requestJSON(
                    "/api/audio/stream/current?sid=\(sessionId)",
                    decode: StreamResponse.self
                )
                
                if response.success, let urlString = response.streamUrl {
                    print("AudioPlayer: Got stream URL: \(urlString)")
                    await MainActor.run {
                        self.setupPlayerWithURL(urlString)
                    }
                } else {
                    print("AudioPlayer: Stream error - \(response.error ?? "unknown")")
                }
            } catch {
                print("AudioPlayer: getStreamURL error - \(error)")
            }
        }
    }
    
    private func setupPlayerWithURL(_ urlString: String) {
        // Handle relative URLs
        var finalURL: URL
        if urlString.hasPrefix("/") {
            finalURL = AppConfig.apiBaseURL.appendingPathComponent(String(urlString.dropFirst()))
        } else if let absolute = URL(string: urlString) {
            finalURL = absolute
        } else {
            print("AudioPlayer: Invalid URL")
            return
        }
        
        print("AudioPlayer: Setting up player with: \(finalURL)")
        
        cleanup()
        
        var request = URLRequest(url: finalURL)
        request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)", forHTTPHeaderField: "User-Agent")
        request.setValue("anonymous", forHTTPHeaderField: "Access-Control-Request-Headers")
        
        let asset = AVURLAsset(url: finalURL)
        let playerItem = AVPlayerItem(asset: asset)
        
        player = AVPlayer(playerItem: playerItem)
        player?.automaticallyWaitsToMinimizeStalling = true
        
        observePlayerItem(playerItem)
        addTimeObserver()
        play()
    }
    
    private func observePlayerItem(_ playerItem: AVPlayerItem) {
        playerItem.publisher(for: \.status)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                print("AudioPlayer status: \(status)")
                switch status {
                case .readyToPlay:
                    self?.duration = playerItem.duration.seconds
                    self?.isAudioLoaded = true
                    print("AudioPlayer: READY!")
                case .failed:
                    print("AudioPlayer FAILED: \(playerItem.error?.localizedDescription ?? "unknown")")
                    self?.isAudioLoaded = false
                default:
                    break
                }
            }
            .store(in: &cancellables)
        
        NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime, object: playerItem)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.handlePlaybackEnded()
            }
            .store(in: &cancellables)
    }
    
    private func addTimeObserver() {
        let interval = CMTime(seconds: 0.5, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        timeObserverToken = player?.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            self?.currentTime = time.seconds
        }
    }
    
    private func handlePlaybackEnded() {
        Task { @MainActor in
            await sendNextCommand()
            getStreamURL()
        }
    }
    
    private func sendNextCommand() async {
        struct NextResponse: Codable {
            let success: Bool
        }
        
        do {
            let _: NextResponse = try await api.requestJSON(
                "/api/player/next",
                method: "POST",
                decode: NextResponse.self
            )
        } catch {
            print("AudioPlayer: Next command error - \(error)")
        }
    }
    
    private func cleanup() {
        if let token = timeObserverToken {
            player?.removeTimeObserver(token)
            timeObserverToken = nil
        }
        player?.pause()
        player = nil
        cancellables.removeAll()
        currentTime = 0
        duration = 0
        isAudioLoaded = false
    }
    
    func play() {
        player?.play()
        isPlaying = true
    }
    
    func pause() {
        player?.pause()
        isPlaying = false
        Task { @MainActor in
            await sendPauseCommand()
        }
    }
    
    private func sendPauseCommand() async {
        struct PauseResponse: Codable {
            let success: Bool
        }
        
        do {
            let _: PauseResponse = try await api.requestJSON(
                "/api/player/pause",
                method: "POST",
                decode: PauseResponse.self
            )
        } catch {
            print("AudioPlayer: Pause command error - \(error)")
        }
    }
    
    func togglePlayback() {
        if isPlaying {
            pause()
        } else {
            play()
            Task { @MainActor in
                await sendResumeCommand()
            }
        }
    }
    
    private func sendResumeCommand() async {
        struct ResumeResponse: Codable {
            let success: Bool
        }
        
        do {
            let _: ResumeResponse = try await api.requestJSON(
                "/api/player/resume",
                method: "POST",
                decode: ResumeResponse.self
            )
        } catch {
            print("AudioPlayer: Resume command error - \(error)")
        }
    }
    
    func seek(to time: Double) {
        let cmTime = CMTime(seconds: time, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        player?.seek(to: cmTime)
        Task { @MainActor in
            await sendSeekCommand(time: time)
        }
    }
    
    private func sendSeekCommand(time: Double) async {
        struct SeekResponse: Codable {
            let success: Bool
        }
        
        do {
            let body = try JSONSerialization.data(withJSONObject: ["time": time], options: [])
            let _: SeekResponse = try await api.requestJSON(
                "/api/player/seek",
                method: "POST",
                body: body,
                decode: SeekResponse.self
            )
        } catch {
            print("AudioPlayer: Seek command error - \(error)")
        }
    }
    
    deinit {
        cleanup()
    }
}
