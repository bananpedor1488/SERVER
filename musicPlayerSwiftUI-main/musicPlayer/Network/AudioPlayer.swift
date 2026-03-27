import AVFoundation
import Combine

class AudioPlayer: ObservableObject {
    private var player: AVPlayer?
    private var timeObserverToken: Any?
    private var currentURL: URL?
    
    @Published var currentTime: Double = 0
    @Published var duration: Double = 0
    @Published var isPlaying: Bool = false
    @Published var isAudioLoaded: Bool = false
    
    private var cancellables = Set<AnyCancellable>()

    func loadAudio(from urlString: String) {
        print("AudioPlayer.loadAudio() called with: '\(urlString)'")
        
        guard let url = URL(string: urlString) else {
            print("AudioPlayer ERROR: Invalid URL string")
            return
        }
        
        print("AudioPlayer: URL is valid, proceeding...")
        
        // Check if the audio is already loaded and playing the same URL
        if isAudioLoaded, url == currentURL, isPlaying {
            print("AudioPlayer: Already playing this URL, skipping")
            return
        }
        
        currentURL = url
        
        // Attempt to load from cache if available
        if let cachedURL = getCachedAudioURL(for: url) {
            print("AudioPlayer: Found cached URL")
            setupPlayer(with: cachedURL)
        } else {
            print("AudioPlayer: Downloading audio...")
            // If not in cache, download and cache it
            downloadAndCacheAudio(from: url)
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
    
    func togglePlayback() {
        if isPlaying {
            pause()
        } else {
            play()
        }
    }
    
    func seek(to time: Double) {
        player?.seek(to: CMTime(seconds: time, preferredTimescale: 1))
    }
    
    private func setupPlayer(with url: URL) {
        print("AudioPlayer.setupPlayer() with URL: \(url)")
        
        let playerItem = AVPlayerItem(url: url)
        player = AVPlayer(playerItem: playerItem)
        
        print("AudioPlayer: AVPlayer created, waiting for readyToPlay...")
        
        // Observe when audio is ready
        playerItem.publisher(for: \.status)
            .sink { [weak self] status in
                print("AudioPlayer status: \(status)")
                if status == .readyToPlay {
                    print("AudioPlayer: READY TO PLAY!")
                    self?.duration = playerItem.duration.seconds
                    self?.isAudioLoaded = true
                } else if status == .failed {
                    print("AudioPlayer FAILED: \(playerItem.error?.localizedDescription ?? "unknown error")")
                }
            }
            .store(in: &cancellables)
        
        addPeriodicTimeObserver()
        play()
    }
    
    private func downloadAndCacheAudio(from url: URL) {
        print("AudioPlayer: Starting download from \(url)")
        URLSession.shared.downloadTask(with: url) { [weak self] localURL, response, error in
            if let error = error {
                print("AudioPlayer download ERROR: \(error.localizedDescription)")
                return
            }
            print("AudioPlayer: Download completed, caching...")
            
            guard let self = self, let localURL = localURL else { return }
            let cacheURL = self.getCacheURL(for: url)
            
            do {
                try FileManager.default.moveItem(at: localURL, to: cacheURL)
                DispatchQueue.main.async {
                    print("AudioPlayer: Cache ready, setting up player")
                    self.setupPlayer(with: cacheURL)
                }
            } catch {
                print("Error caching audio file:", error)
            }
        }.resume()
    }
    
    private func getCacheURL(for url: URL) -> URL {
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        return cacheDir.appendingPathComponent(url.lastPathComponent)
    }
    
    private func getCachedAudioURL(for url: URL) -> URL? {
        let cacheURL = getCacheURL(for: url)
        return FileManager.default.fileExists(atPath: cacheURL.path) ? cacheURL : nil
    }
    
    private func addPeriodicTimeObserver() {
        let timeScale = CMTimeScale(NSEC_PER_SEC)
        let time = CMTime(seconds: 0.5, preferredTimescale: timeScale)
        
        timeObserverToken = player?.addPeriodicTimeObserver(forInterval: time, queue: .main) { [weak self] time in
            self?.currentTime = time.seconds
        }
    }
    
    deinit {
        if let token = timeObserverToken {
            player?.removeTimeObserver(token)
        }
    }
}
