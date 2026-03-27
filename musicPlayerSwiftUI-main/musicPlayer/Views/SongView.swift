import AVFoundation
import SwiftUI

struct SongView: View {
    var song: Song {
        mediaPlayerState.currentSong
    }
    
    @EnvironmentObject var mediaPlayerState: MediaPlayerState
    @StateObject private var audioPlayer = AudioPlayer()
    @State private var isSliderEditing = false
    @State private var lastSongId: String = ""
    
    var body: some View {
        ZStack {
            backgroundView
            
            if mediaPlayerState.isMediaPlayerExpanded {
                expandedPlayerView
            } else {
                miniPlayerView
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
    
    private var backgroundView: some View {
        AsyncImage(url: URL(string: song.imageLargeURL)) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
            default:
                Color.purple.opacity(0.8)
            }
        }
        .blur(radius: 30)
        .overlay(Color.black.opacity(0.6))
        .ignoresSafeArea()
    }
    
    private var expandedPlayerView: some View {
        VStack(spacing: 20) {
            Spacer()
            
            AsyncImage(url: URL(string: song.imageLargeURL)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                default:
                    Circle()
                        .fill(Color.gray.opacity(0.3))
                }
            }
            .frame(width: 280, height: 280)
            .clipShape(Circle())
            .shadow(radius: 20)
            
            VStack(spacing: 8) {
                Text(song.title)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                
                Text(song.displayName)
                    .font(.body)
                    .foregroundColor(.gray)
            }
            .padding(.horizontal)
            
            progressView
            
            playbackControls
            
            Spacer()
        }
        .padding()
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
                
                HStack {
                    Text(timeString(for: audioPlayer.currentTime))
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                    Spacer()
                    Text(timeString(for: audioPlayer.duration))
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                }
            } else {
                if !song.audioURL.isEmpty {
                    ProgressView()
                        .tint(.white)
                    Text("Loading...")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                } else {
                    Text("No audio")
                        .foregroundColor(.red)
                }
            }
        }
        .padding(.horizontal)
    }
    
    private var playbackControls: some View {
        HStack(spacing: 50) {
            Button(action: { }) {
                Image(systemName: "backward.fill")
                    .font(.title)
                    .foregroundColor(.white)
            }
            
            Button(action: {
                if isSliderEditing {
                    audioPlayer.play()
                } else {
                    audioPlayer.togglePlayback()
                }
            }) {
                ZStack {
                    Circle()
                        .fill(Color.white)
                        .frame(width: 70, height: 70)
                    
                    Image(systemName: audioPlayer.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title)
                        .foregroundColor(.black)
                }
            }
            
            Button(action: { }) {
                Image(systemName: "forward.fill")
                    .font(.title)
                    .foregroundColor(.white)
            }
        }
    }
    
    private var miniPlayerView: some View {
        HStack(spacing: 12) {
            AsyncImage(url: URL(string: song.imageLargeURL)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                default:
                    Circle()
                        .fill(Color.gray.opacity(0.3))
                }
            }
            .frame(width: 50, height: 50)
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
            
            Button(action: {
                audioPlayer.togglePlayback()
            }) {
                Image(systemName: audioPlayer.isPlaying ? "pause.fill" : "play.fill")
                    .font(.title2)
                    .foregroundColor(.white)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            LinearGradient(
                colors: [.purple.opacity(0.8), .blue.opacity(0.8)],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
    }
    
    private func setupAudio() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Audio session setup failed: \(error)")
        }
        
        print("=== SONG AUDIO ===")
        print("song.id = '\(song.id)'")
        print("song.title = '\(song.title)'")
        print("===================")
        
        if !song.id.isEmpty {
            print("Calling audioPlayer.loadAudio()")
            audioPlayer.loadAudio(from: song.id)
        } else {
            print("WARNING: song.id is EMPTY!")
        }
    }
    
    private func timeString(for seconds: Double) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }
}
