import Foundation
import AVFoundation
import Combine

@MainActor
public final class PlayerStore: ObservableObject {
    @Published var queue: [Track] = []
    @Published var currentIndex: Int = 0
    @Published var isPlaying: Bool = false
    @Published var currentTime: Double = 0
    @Published var duration: Double = 0
    @Published var repeatMode: RepeatMode = .none
    @Published var shuffleEnabled: Bool = false
    @Published var likedTracks: Set<String> = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var cancellables = Set<AnyCancellable>()
    private let api = APIClient()

    init() {
        setupAudioSession()
    }

    deinit {
        Task { @MainActor in
            if let observer = timeObserver {
                player?.removeTimeObserver(observer)
            }
        }
    }

    private func setupAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to setup audio session: \(error)")
        }
    }

    var nowPlaying: Track? {
        guard currentIndex >= 0 && currentIndex < queue.count else { return nil }
        return queue[currentIndex]
    }

    var hasNext: Bool {
        currentIndex < queue.count - 1 || repeatMode == .all
    }

    var hasPrevious: Bool {
        currentIndex > 0 || repeatMode == .all
    }

    var progress: Double {
        let effectiveDuration = effectiveTotalDuration
        guard effectiveDuration > 0 else { return 0 }
        return currentTime / effectiveDuration
    }

    var effectiveTotalDuration: Double {
        if duration > 0 {
            return duration
        }
        if let track = nowPlaying, track.duration > 0 {
            return Double(track.duration)
        }
        return 0
    }

    func play(track: Track, from newQueue: [Track]? = nil) {
        if let newQueue = newQueue {
            self.queue = shuffleEnabled ? newQueue.shuffled() : newQueue
            if let index = self.queue.firstIndex(where: { $0.id == track.id }) {
                self.currentIndex = index
            }
        }
        loadAndPlay(track)
    }

    func playTrack(at index: Int) {
        guard index >= 0 && index < queue.count else { return }
        currentIndex = index
        if let track = nowPlaying {
            loadAndPlay(track)
        }
    }

    private func loadAndPlay(_ track: Track) {
        isLoading = true
        errorMessage = nil
        currentTime = 0
        duration = 0

        cancellables.removeAll()

        guard let streamUrlString = track.streamUrl,
              let streamURL = URL(string: streamUrlString) else {
            isLoading = false
            errorMessage = "Stream URL not available"
            return
        }

        player?.pause()
        if let observer = timeObserver {
            player?.removeTimeObserver(observer)
            timeObserver = nil
        }

        let playerItem = AVPlayerItem(url: streamURL)
        player = AVPlayer(playerItem: playerItem)
        player?.automaticallyWaitsToMinimizeStalling = true

        setupTimeObserver()
        setupPlayerItemObserver(playerItem, track: track)

        player?.play()
        isPlaying = true
    }

    private func setupTimeObserver() {
        let interval = CMTime(seconds: 0.3, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        timeObserver = player?.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            Task { @MainActor in
                guard let self = self else { return }
                self.currentTime = time.seconds
            }
        }
    }

    private func setupPlayerItemObserver(_ item: AVPlayerItem, track: Track) {
        item.publisher(for: \.status)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                guard let self = self else { return }
                switch status {
                case .readyToPlay:
                    self.isLoading = false
                    let assetDuration = item.asset.duration.seconds
                    if assetDuration.isFinite && assetDuration > 0 {
                        self.duration = assetDuration
                    } else if track.duration > 0 {
                        self.duration = Double(track.duration)
                    }
                case .failed:
                    self.isLoading = false
                    self.errorMessage = item.error?.localizedDescription ?? "Playback failed"
                    self.duration = track.duration > 0 ? Double(track.duration) : 0
                default:
                    break
                }
            }
            .store(in: &cancellables)

        item.publisher(for: \.duration)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] dur in
                guard let self = self else { return }
                let seconds = dur.seconds
                if seconds.isFinite && seconds > 0 {
                    self.duration = seconds
                } else if track.duration > 0 && self.duration == 0 {
                    self.duration = Double(track.duration)
                }
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime, object: item)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.handleTrackEnded()
            }
            .store(in: &cancellables)
    }

    private func handleTrackEnded() {
        switch repeatMode {
        case .one:
            seek(to: 0)
            play()
        case .all:
            if currentIndex < queue.count - 1 {
                next()
            } else {
                currentIndex = 0
                if let track = nowPlaying {
                    loadAndPlay(track)
                }
            }
        case .none:
            if currentIndex < queue.count - 1 {
                next()
            } else {
                pause()
            }
        }
    }

    func addToQueue(_ track: Track) {
        queue.append(track)
    }

    func playNext(_ track: Track) {
        let insertIndex = currentIndex + 1
        if insertIndex <= queue.count {
            queue.insert(track, at: insertIndex)
        } else {
            queue.append(track)
        }
    }

    func togglePlayPause() {
        if isPlaying {
            pause()
        } else {
            play()
        }
    }

    func play() {
        player?.play()
        isPlaying = true
    }

    func pause() {
        player?.pause()
        isPlaying = false
    }

    func next() {
        if currentIndex < queue.count - 1 {
            currentIndex += 1
            if let track = nowPlaying {
                loadAndPlay(track)
            }
        } else if repeatMode == .all && !queue.isEmpty {
            currentIndex = 0
            if let track = nowPlaying {
                loadAndPlay(track)
            }
        }

    }

    func previous() {
        if currentTime > 3 {
            seek(to: 0)
        } else if currentIndex > 0 {
            currentIndex -= 1
            if let track = nowPlaying {
                loadAndPlay(track)
            }
        } else if repeatMode == .all && !queue.isEmpty {
            currentIndex = queue.count - 1
            if let track = nowPlaying {
                loadAndPlay(track)
            }
        }
    }

    func seek(to time: Double) {
        let clamped = min(max(0, time), effectiveTotalDuration)
        currentTime = clamped

        let cmTime = CMTime(seconds: clamped, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        player?.seek(to: cmTime, toleranceBefore: .zero, toleranceAfter: .zero)
    }

    func seekByProgress(_ progress: Double) {
        seek(to: progress * effectiveTotalDuration)
    }

    func toggleShuffle() {
        shuffleEnabled.toggle()
        if shuffleEnabled && queue.count > 1 {
            let current = nowPlaying
            queue.shuffle()
            if let track = current {
                if let index = queue.firstIndex(where: { $0.id == track.id }) {
                    queue.remove(at: index)
                    queue.insert(track, at: 0)
                    currentIndex = 0
                }
            }
        }
    }

    func toggleRepeat() {
        repeatMode = repeatMode.next()
    }

    func toggleLike(_ track: Track) {
        if likedTracks.contains(track.id) {
            likedTracks.remove(track.id)
        } else {
            likedTracks.insert(track.id)
        }
    }

    func isLiked(_ track: Track) -> Bool {
        likedTracks.contains(track.id)
    }

    func clearQueue() {
        pause()
        queue = []
        currentIndex = 0
        currentTime = 0
        duration = 0
    }
}
