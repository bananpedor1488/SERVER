import AVFoundation
import Combine
import Foundation

class AudioPlayer: ObservableObject {
    private var player: AVPlayer?
    private var timeObserverToken: Any?
    
    @Published var currentTime: Double = 0
    @Published var duration: Double = 0
    @Published var isPlaying: Bool = false
    @Published var isAudioLoaded: Bool = false
    
    private var cancellables = Set<AnyCancellable>()
    private let api = APIClient()

    func loadAudio(from trackId: String) {
        print("AudioPlayer: Loading track \(trackId)")
        
        Task { @MainActor in
            await sendPlayCommand(trackId: trackId)
        }
        
        // Play directly via server proxy
        let streamURL = "\(AppConfig.apiBaseURL)/api/audio/stream/soundcloud/\(trackId)"
        print("AudioPlayer: Stream URL: \(streamURL)")
        setupPlayerWithProxy(streamURL)
    }
    
    private func sendPlayCommand(trackId: String) async {
        struct PlayResponse: Codable {
            let success: Bool
        }
        
        do {
            let body = try JSONSerialization.data(withJSONObject: [
                "track": ["id": trackId, "type": "soundcloud"],
                "queue": [["id": trackId, "type": "soundcloud"]],
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
    
    private func setupPlayerWithProxy(_ urlString: String) {
        guard let url = URL(string: urlString) else {
            print("AudioPlayer: Invalid URL")
            return
        }
        
        print("AudioPlayer: Setting up player with: \(url)")
        
        cleanup()
        
        let asset = AVURLAsset(url: url)
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
            print("AudioPlayer: Pause error - \(error)")
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
            print("AudioPlayer: Resume error - \(error)")
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
            print("AudioPlayer: Seek error - \(error)")
        }
    }
    
    deinit {
        cleanup()
    }
}
