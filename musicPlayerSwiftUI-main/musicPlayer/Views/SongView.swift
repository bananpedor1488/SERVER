import AVFoundation
import MediaPlayer
import SwiftUI

struct SongView: View {
    var song: Song {
        mediaPlayerState.currentSong
    }
    
    @EnvironmentObject var mediaPlayerState: MediaPlayerState
    @StateObject private var audioManager = AudioPlayerManager.shared
    @State private var isSliderEditing = false
    @State private var lastSongId: String = ""
    @State private var isLiked: Bool = false
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                backgroundView
                
                if mediaPlayerState.isMediaPlayerExpanded {
                    expandedPlayerView(geometry: geometry)
                } else {
                    miniPlayerView
                }
            }
        }
        .onChange(of: song.id) { _, newId in
            if newId != lastSongId && !newId.isEmpty {
                lastSongId = newId
                setupAudio()
            }
        }
        .onAppear {
            if lastSongId.isEmpty && !song.id.isEmpty {
                lastSongId = song.id
                setupAudio()
            }
        }
    }
    
    private var backgroundView: some View {
        AsyncImage(url: URL(string: song.imageLargeURL)) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
            default:
                LinearGradient(
                    colors: [.purple.opacity(0.8), .blue.opacity(0.8)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        }
        .blur(radius: 30)
        .overlay(Color.black.opacity(0.6))
        .ignoresSafeArea()
    }
    
    private func expandedPlayerView(geometry: GeometryProxy) -> some View {
        VStack(spacing: 0) {
            dragIndicator
            
            ScrollView(showsIndicators: false) {
                VStack(spacing: 24) {
                    Spacer(minLength: 20)
                    
                    coverImage
                    
                    trackInfo
                    
                    progressView
                    
                    playbackControls
                    
                    extraControls
                    
                    Spacer(minLength: 40)
                }
                .padding(.horizontal, 24)
            }
        }
    }
    
    private var dragIndicator: some View {
        Capsule()
            .fill(Color.white.opacity(0.5))
            .frame(width: 36, height: 5)
            .padding(.top, 8)
            .onTapGesture {
                withAnimation(.spring()) {
                    mediaPlayerState.isMediaPlayerExpanded = false
                }
            }
    }
    
    private var coverImage: some View {
        AsyncImage(url: URL(string: song.imageLargeURL)) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
            default:
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.gray.opacity(0.3))
                    .overlay(
                        Image(systemName: "music.note")
                            .font(.system(size: 50))
                            .foregroundColor(.white.opacity(0.5))
                    )
            }
        }
        .frame(width: min(UIScreen.main.bounds.width - 48, 320), height: min(UIScreen.main.bounds.width - 48, 320))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.3), radius: 20, x: 0, y: 10)
    }
    
    private var trackInfo: some View {
        VStack(spacing: 8) {
            Text(song.title)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .multilineTextAlignment(.center)
                .lineLimit(2)
            
            Text(song.displayName)
                .font(.body)
                .foregroundColor(.white.opacity(0.7))
        }
    }
    
    private var progressView: some View {
        VStack(spacing: 8) {
            CustomSlider(value: Binding(
                get: { audioManager.currentTime },
                set: { newValue in
                    if !isSliderEditing {
                        audioManager.currentTime = newValue
                    }
                }
            ), range: 0...max(audioManager.duration, 1)) { editing in
                isSliderEditing = editing
                if editing {
                    audioManager.pause()
                } else {
                    audioManager.seek(to: audioManager.currentTime)
                    audioManager.play()
                }
            }
            .frame(height: 20)
            
            HStack {
                Text(formatTime(audioManager.currentTime))
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                    .monospacedDigit()
                Spacer()
                Text("-\(formatTime(max(0, audioManager.duration - audioManager.currentTime)))")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                    .monospacedDigit()
            }
        }
    }
    
    private var playbackControls: some View {
        HStack(spacing: 40) {
            Button(action: { audioManager.toggleShuffle() }) {
                Image(systemName: "shuffle")
                    .font(.title3)
                    .foregroundColor(audioManager.isShuffleEnabled ? .purple : .white.opacity(0.7))
            }
            
            Button(action: { audioManager.previous() }) {
                Image(systemName: "backward.fill")
                    .font(.title)
                    .foregroundColor(.white)
            }
            
            Button(action: {
                if isSliderEditing {
                    audioManager.play()
                } else {
                    audioManager.togglePlayback()
                }
            }) {
                ZStack {
                    Circle()
                        .fill(Color.white)
                        .frame(width: 70, height: 70)
                    
                    Image(systemName: audioManager.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title)
                        .foregroundColor(.black)
                        .offset(x: audioManager.isPlaying ? 0 : 2)
                }
            }
            
            Button(action: { audioManager.next() }) {
                Image(systemName: "forward.fill")
                    .font(.title)
                    .foregroundColor(.white)
            }
            
            Button(action: { audioManager.toggleRepeat() }) {
                Image(systemName: audioManager.repeatMode == .one ? "repeat.1" : "repeat")
                    .font(.title3)
                    .foregroundColor(audioManager.repeatMode == .none ? .white.opacity(0.7) : .purple)
            }
        }
    }
    
    private var extraControls: some View {
        HStack(spacing: 50) {
            Button(action: {
                isLiked.toggle()
            }) {
                Image(systemName: isLiked ? "heart.fill" : "heart")
                    .font(.title2)
                    .foregroundColor(isLiked ? .red : .white.opacity(0.7))
            }
            
            Button(action: {
                // Share action
            }) {
                Image(systemName: "square.and.arrow.up")
                    .font(.title2)
                    .foregroundColor(.white.opacity(0.7))
            }
        }
    }
    
    private var miniPlayerView: some View {
        VStack(spacing: 0) {
            miniProgressBar
            
            HStack(spacing: 12) {
                AsyncImage(url: URL(string: song.imageLargeURL)) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color.gray.opacity(0.3))
                    }
                }
                .frame(width: 48, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(song.title)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                    
                    Text(song.displayName)
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                        .lineLimit(1)
                }
                
                Spacer()
                
                Button(action: { audioManager.togglePlayback() }) {
                    Image(systemName: audioManager.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title2)
                        .foregroundColor(.white)
                }
                
                Button(action: { audioManager.next() }) {
                    Image(systemName: "forward.fill")
                        .font(.title3)
                        .foregroundColor(.white)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(
            LinearGradient(
                colors: [.purple.opacity(0.9), .blue.opacity(0.9)],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation(.spring()) {
                mediaPlayerState.isMediaPlayerExpanded = true
            }
        }
    }
    
    private var miniProgressBar: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(Color.white.opacity(0.3))
                    .frame(height: 3)
                
                Rectangle()
                    .fill(Color.white)
                    .frame(width: geometry.size.width * audioManager.progress, height: 3)
            }
        }
        .frame(height: 3)
    }
    
    private func setupAudio() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            setupRemoteTransportControls()
        } catch {
            print("Audio session setup failed: \(error)")
        }
        
        if !song.id.isEmpty {
            audioManager.loadAudio(from: song.id)
        }
    }
    
    private func setupRemoteTransportControls() {
        let commandCenter = MPRemoteCommandCenter.shared()
        
        commandCenter.playCommand.addTarget { [self] _ in
            audioManager.play()
            return .success
        }
        
        commandCenter.pauseCommand.addTarget { [self] _ in
            audioManager.pause()
            return .success
        }
        
        commandCenter.nextTrackCommand.addTarget { [self] _ in
            audioManager.next()
            return .success
        }
        
        commandCenter.previousTrackCommand.addTarget { [self] _ in
            audioManager.previous()
            return .success
        }
        
        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            Task { @MainActor in
                self?.audioManager.seek(to: event.positionTime)
            }
            return .success
        }
    }
    
    private func formatTime(_ seconds: Double) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }
}

struct CustomSlider: View {
    @Binding var value: Double
    let range: ClosedRange<Double>
    let onEditingChanged: (Bool) -> Void
    
    @State private var isDragging = false
    
    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.white.opacity(0.3))
                    .frame(height: 6)
                
                Capsule()
                    .fill(Color.white)
                    .frame(width: max(0, progress * geometry.size.width), height: 6)
                
                Circle()
                    .fill(Color.white)
                    .frame(width: isDragging ? 20 : 14, height: isDragging ? 20 : 14)
                    .offset(x: max(0, progress * geometry.size.width - (isDragging ? 10 : 7)))
                    .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
            }
            .frame(height: 20)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { gesture in
                        if !isDragging {
                            isDragging = true
                            onEditingChanged(true)
                        }
                        let newProgress = min(max(0, gesture.location.x / geometry.size.width), 1)
                        value = range.lowerBound + newProgress * (range.upperBound - range.lowerBound)
                    }
                    .onEnded { _ in
                        isDragging = false
                        onEditingChanged(false)
                    }
            )
        }
    }
    
    private var progress: Double {
        let normalized = (value - range.lowerBound) / (range.upperBound - range.lowerBound)
        return min(max(0, normalized), 1)
    }
}
