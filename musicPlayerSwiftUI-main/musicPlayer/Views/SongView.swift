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
    @State private var dragOffset: CGFloat = 0
    @State private var isLiked: Bool = false
    
    var body: some View {
        ZStack {
            backgroundView
            
            Group {
                if mediaPlayerState.isMediaPlayerExpanded {
                    expandedPlayerView
                } else {
                    miniPlayerView
                }
            }
        }
        .animation(.easeIn(duration: 0.6), value: mediaPlayerState.isMediaPlayerExpanded)
        .onChange(of: song.id) { _, newId in
            if !newId.isEmpty {
                setupAudio()
            }
        }
        .onAppear {
            setupAudio()
        }
    }
    
    private var backgroundView: some View {
        ZStack {
            CachedAsyncImage(url: URL(string: song.imageLargeURL))
                .blur(radius: 30, opaque: true)
            
            Color.black.opacity(0.5)
        }
        .ignoresSafeArea()
    }
    
    private var expandedPlayerView: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                dragIndicator
                    .offset(y: dragOffset)
                    .animation(.spring(response: 0.4, dampingFraction: 0.6), value: dragOffset)
                
                Spacer()
                
                coverImage
                
                trackInfo
                
                progressView
                
                playbackControls
                
                extraControls
                
                Spacer()
            }
            .padding()
            .offset(y: dragOffset)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        dragOffset = min(value.translation.height, geometry.size.height / 2)
                    }
                    .onEnded { value in
                        if value.translation.height > geometry.size.height / 4 {
                            withAnimation(.spring()) {
                                mediaPlayerState.isMediaPlayerExpanded = false
                                dragOffset = 0
                            }
                        } else {
                            withAnimation(.spring()) {
                                dragOffset = 0
                            }
                        }
                    }
            )
        }
    }
    
    private var dragIndicator: some View {
        RoundedRectangle(cornerRadius: 3)
            .frame(width: 50, height: 5)
            .foregroundColor(.white.opacity(0.7))
            .padding(.top, 10)
            .padding(.bottom, 30)
    }
    
    private var coverImage: some View {
        CachedAsyncImage(url: URL(string: song.imageLargeURL))
            .frame(width: 280, height: 280)
            .clipShape(Circle())
            .shadow(radius: 15)
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
        .padding(.horizontal)
    }
    
    private var progressView: some View {
        VStack(spacing: 8) {
            Slider(value: Binding(
                get: { audioManager.currentTime },
                set: { newValue in
                    if !isSliderEditing {
                        audioManager.currentTime = newValue
                    }
                }
            ), in: 0...max(audioManager.duration, 1), step: 1) { editing in
                isSliderEditing = editing
                if editing {
                    audioManager.pause()
                } else {
                    audioManager.seek(to: audioManager.currentTime)
                    audioManager.play()
                }
            }
            .tint(.purple)
            .padding(.horizontal)
            
            HStack {
                Text(formatTime(audioManager.currentTime))
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                    .monospacedDigit()
                Spacer()
                Text(formatTime(audioManager.duration))
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                    .monospacedDigit()
            }
            .padding(.horizontal)
        }
    }
    
    private var playbackControls: some View {
        HStack(spacing: 40) {
            Button(action: { audioManager.toggleShuffle() }) {
                Image(systemName: "shuffle")
                    .font(.title3)
                    .foregroundColor(audioManager.isShuffleEnabled ? .purple : .white.opacity(0.6))
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
                        .fill(Color.purple)
                        .frame(width: 70, height: 70)
                    
                    Image(systemName: audioManager.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title)
                        .foregroundColor(.white)
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
                    .foregroundColor(audioManager.repeatMode == .none ? .white.opacity(0.6) : .purple)
            }
        }
        .padding(.vertical, 10)
    }
    
    private var extraControls: some View {
        HStack(spacing: 60) {
            Button(action: {
                isLiked.toggle()
            }) {
                Image(systemName: isLiked ? "heart.fill" : "heart")
                    .font(.title2)
                    .foregroundColor(isLiked ? .red : .white.opacity(0.6))
            }
            
            Button(action: {
                // Share
            }) {
                Image(systemName: "square.and.arrow.up")
                    .font(.title2)
                    .foregroundColor(.white.opacity(0.6))
            }
        }
        .padding(.top, 10)
    }
    
    private var miniPlayerView: some View {
        HStack(spacing: 12) {
            CachedAsyncImage(url: URL(string: song.imageLargeURL))
                .frame(width: 45, height: 45)
                .clipShape(Circle())
                .shadow(radius: 5)
            
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
            
            Button(action: {
                audioManager.togglePlayback()
            }) {
                Image(systemName: audioManager.isPlaying ? "pause.fill" : "play.fill")
                    .font(.title2)
                    .foregroundColor(.white)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.black.opacity(0.8))
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation(.spring()) {
                mediaPlayerState.isMediaPlayerExpanded = true
            }
        }
    }
    
    private func setupAudio() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            setupRemoteControls()
        } catch {
            print("Audio session setup failed")
        }
        
        if !song.id.isEmpty {
            audioManager.loadAudio(from: song.id)
        }
    }
    
    private func setupRemoteControls() {
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
        
        commandCenter.changePlaybackPositionCommand.addTarget { event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            self.audioManager.seek(to: event.positionTime)
            return .success
        }
    }
    
    private func formatTime(_ seconds: Double) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }
}
