import AVFoundation
import SwiftUI

struct SongView: View {
    var song: Song {
        mediaPlayerState.currentSong
    }
    
    @EnvironmentObject var mediaPlayerState: MediaPlayerState
    @StateObject private var audioPlayer = AudioPlayer()
    @State private var isSliderEditing = false
    @State private var dragOffset: CGFloat = 0
    @State private var lastSongId: String = ""
    
    var body: some View {
        ZStack {
            AsyncImage(url: URL(string: song.imageLargeURL)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                        .blur(radius: 30)
                        .overlay(Color.black.opacity(0.5))
                default:
                    Color.black
                }
            }
            .ignoresSafeArea()
            
            Group {
                if mediaPlayerState.isMediaPlayerExpanded {
                    expandedPlayerView
                } else {
                    miniPlayerView
                }
            }
        }
        .onChange(of: song.id) { _, newId in
            if newId != lastSongId {
                lastSongId = newId
                setupAudio()
            }
        }
        .onAppear {
            if lastSongId.isEmpty {
                lastSongId = song.id
                setupAudio()
            }
        }
    }
    
    private var expandedPlayerView: some View {
        GeometryReader { geometry in
            VStack(spacing: 20) {
                RoundedRectangle(cornerRadius: 3)
                    .frame(width: 50, height: 5)
                    .foregroundColor(Color.gray.opacity(0.7))
                    .padding(.top, 10)
                    .padding(.bottom, 150)
                    .offset(y: dragOffset)
                    .animation(.spring(response: 0.4, dampingFraction: 0.6), value: dragOffset)
                
                Spacer()
                
                AsyncImage(url: URL(string: song.imageLargeURL)) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                            .frame(width: 250, height: 250)
                            .clipShape(Circle())
                            .shadow(radius: 10)
                    default:
                        Circle()
                            .fill(Color.gray.opacity(0.3))
                            .frame(width: 250, height: 250)
                    }
                }
                .transition(.scale)
                
                VStack(spacing: 10) {
                    Text(song.title)
                        .font(.title3)
                        .bold()
                        .foregroundColor(.white)
                        .transition(.opacity)
                    
                    Text(song.displayName)
                        .font(.subheadline)
                        .foregroundColor(.gray)
                }
                
                progressView
                
                playbackControls
                
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
                                dragOffset = geometry.size.height
                                mediaPlayerState.isMediaPlayerExpanded.toggle()
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
    
    private var progressView: some View {
        VStack(spacing: 8) {
            if audioPlayer.duration > 0 || audioPlayer.isAudioLoaded {
                Slider(value: $audioPlayer.currentTime, in: 0 ... max(audioPlayer.duration, 1), step: 1) { editing in
                    isSliderEditing = editing
                    if editing {
                        audioPlayer.pause()
                    } else {
                        audioPlayer.seek(to: audioPlayer.currentTime)
                        audioPlayer.play()
                    }
                }
                .tint(.white)
                .padding(.horizontal)
                
                HStack {
                    Text(timeString(for: audioPlayer.currentTime))
                        .font(.caption)
                        .foregroundColor(.gray)
                    Spacer()
                    Text(timeString(for: audioPlayer.duration))
                        .font(.caption)
                        .foregroundColor(.gray)
                }
                .padding(.horizontal)
            } else {
                if audioPlayer.isAudioLoaded == false && !song.audioURL.isEmpty {
                    ProgressView()
                        .tint(.white)
                    Text("Loading audio...")
                        .font(.caption)
                        .foregroundColor(.gray)
                } else if song.audioURL.isEmpty {
                    Text("No audio available")
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
        }
    }
    
    private var playbackControls: some View {
        HStack(spacing: 30) {
            Button(action: { }) {
                Image(systemName: "backward.fill")
                    .font(.title)
                    .foregroundStyle(.white)
            }
            
            Button(action: {
                if isSliderEditing {
                    audioPlayer.play()
                } else {
                    audioPlayer.togglePlayback()
                }
            }) {
                Image(systemName: audioPlayer.isPlaying ? "pause.fill" : "play.fill")
                    .font(.largeTitle)
                    .foregroundStyle(.white)
            }
            
            Button(action: { }) {
                Image(systemName: "forward.fill")
                    .font(.title)
                    .foregroundStyle(.white)
            }
        }
        .padding(.vertical)
        .transition(.move(edge: .bottom))
    }
    
    private var miniPlayerView: some View {
        HStack {
            AsyncImage(url: URL(string: song.imageLargeURL)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .frame(width: 40, height: 40)
                        .clipShape(Circle())
                        .shadow(radius: 5)
                default:
                    Circle()
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 40, height: 40)
                }
            }
            
            VStack(alignment: .leading, spacing: 5) {
                Text(song.title)
                    .font(.subheadline)
                    .bold()
                    .foregroundColor(.white)
                    .lineLimit(1)
                Text(song.displayName)
                    .font(.caption)
                    .foregroundColor(.gray)
                    .lineLimit(1)
            }
            
            Spacer()
            
            Button(action: {
                if isSliderEditing {
                    audioPlayer.play()
                } else {
                    audioPlayer.togglePlayback()
                }
            }) {
                Image(systemName: audioPlayer.isPlaying ? "pause.fill" : "play.fill")
                    .font(.title)
                    .foregroundStyle(.white)
            }
        }
        .padding()
        .transition(.blurReplace)
    }
    
    private func setupAudio() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Audio session setup failed.")
        }
        
        print("Loading audio from: \(song.audioURL)")
        
        if !song.audioURL.isEmpty {
            audioPlayer.loadAudio(from: song.audioURL)
        } else {
            print("ERROR: audioURL is empty!")
        }
    }
    
    private func timeString(for seconds: Double) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%02d:%02d", mins, secs)
    }
}

#Preview {
    SongView()
        .environmentObject(MediaPlayerState())
}
