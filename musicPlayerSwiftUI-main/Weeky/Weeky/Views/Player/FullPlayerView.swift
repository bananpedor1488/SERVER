import SwiftUI
import Foundation

struct FullPlayerView: View {
    @EnvironmentObject private var player: PlayerStore
    @Environment(\.dismiss) private var dismiss
    @State private var showQueue = false
    @State private var showLyrics = false
    @State private var isDragging = false
    @State private var dragProgress: Double = 0
    
    @State private var lyrics: String?
    @State private var syncedLyrics: [LyricLine] = []
    @State private var isSynced = false
    @State private var lyricsLoading = false
    @State private var lyricsError: String?
    
    private let lyricsService = LyricsService()
    
    var body: some View {
        GeometryReader { geometry in
            let safeArea = geometry.safeAreaInsets
            
            ZStack {
                backgroundView
                
                VStack(spacing: 0) {
                    dragIndicator
                        .padding(.top, 12)
                    
            if showLyrics {
                // Lyrics mode - similar to web version
                VStack(spacing: 0) {
                    // Compact artwork and info at top
                    HStack(spacing: 16) {
                        CompactArtworkView()
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(player.nowPlaying?.title ?? "Not Playing")
                                .font(.title3.weight(.bold))
                                .foregroundStyle(.white)
                                .lineLimit(2)
                            
                            Text(player.nowPlaying?.artist ?? "")
                                .font(.body)
                                .foregroundStyle(.white.opacity(0.7))
                                .lineLimit(1)
                        }
                        
                        Spacer()
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 16)
                    
                    // Lyrics take space
                    lyricsView
                        .frame(maxHeight: .infinity)
                    
                    // Progress and controls (always shown)
                    progressView
                        .padding(.top, 28)
                    controlsView
                        .padding(.top, 28)
                    bottomActions
                        .padding(.top, 24)
                }
                .padding(.horizontal, 32)
                .padding(.bottom, safeArea.bottom + 20)
            } else {
                // Normal mode
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 0) {
                        artworkView
                            .padding(.top, 32)
                        
                        trackInfoView
                            .padding(.top, 28)
                        
                        progressView
                            .padding(.top, 28)
                        
                        controlsView
                            .padding(.top, 28)
                        
                        bottomActions
                            .padding(.top, 24)
                        
                        if showLyrics {
                            lyricsView
                                .padding(.top, 24)
                        }
                        
                        Spacer(minLength: 100)
                    }
                    .padding(.horizontal, 32)
                    .frame(minHeight: geometry.size.height - safeArea.bottom - 150)
                }
            }
                    
                    topBar
                        .padding(.horizontal, 16)
                        .padding(.bottom, 12)
                }
            }
        }
        .sheet(isPresented: $showQueue) {
            QueueView()
        }
    }
    
    private var dragIndicator: some View {
        Capsule()
            .fill(Color.white.opacity(0.5))
            .frame(width: 36, height: 5)
    }
    
    private var topBar: some View {
        HStack {
            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.down")
                    .font(.title2.weight(.medium))
                    .foregroundStyle(.white)
            }
            .frame(width: 44, height: 44)
            
            Spacer()
            
            HStack(spacing: 20) {
                Button {
                    handleShare()
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .font(.title3)
                        .foregroundStyle(.white)
                }
                .frame(width: 44, height: 44)
                
                Button {
                    handleDownload()
                } label: {
                    if isDownloading {
                        Image(systemName: "arrow.down.circle")
                            .font(.title3)
                            .foregroundStyle(.white)
                            .rotationEffect(.degrees(isDownloading ? 360 : 0))
                            .animation(.linear(duration: 1.0).repeatForever(autoreverses: false), value: isDownloading)
                    } else if isDownloaded {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title3)
                            .foregroundStyle(.white)
                    } else {
                        Image(systemName: "arrow.down.circle")
                            .font(.title3)
                            .foregroundStyle(.white)
                    }
                }
                .frame(width: 44, height: 44)
                
                Button {
                    showAddToPlaylist = true
                } label: {
                    Image(systemName: "plus.circle")
                        .font(.title3)
                        .foregroundStyle(.white)
                }
                .frame(width: 44, height: 44)
                
                Button {
                    showQueue = true
                } label: {
                    Image(systemName: "list.bullet")
                        .font(.title3)
                        .foregroundStyle(.white)
                }
                .frame(width: 44, height: 44)
            }
        }
    }
    
    private var backgroundView: some View {
        ZStack {
            if let artworkURL = player.nowPlaying?.artworkURL ?? player.nowPlaying?.imageURL {
                AsyncImage(url: artworkURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                            .blur(radius: 80)
                            .opacity(0.7)
                    case .failure(_), .empty:
                        LinearGradient(
                            colors: [Color.purple.opacity(0.9), Color.blue.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    @unknown default:
                        LinearGradient(
                            colors: [Color.purple.opacity(0.9), Color.blue.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    }
                }
            } else {
                LinearGradient(
                    colors: [Color.purple.opacity(0.9), Color.blue.opacity(0.7)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        }
        .ignoresSafeArea()
    }
    
    private var artworkView: some View {
        let size: CGFloat = 280
        
        return Group {
            AsyncImage(url: player.nowPlaying?.artworkURL ?? player.nowPlaying?.imageURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                case .failure(_), .empty:
                    artworkPlaceholder
                @unknown default:
                    artworkPlaceholder
                }
            }
            .frame(width: size, height: size)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.black.opacity(0.3))
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.3), radius: 20, x: 0, y: 10)
        }
    }
    
    private var artworkPlaceholder: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.gray.opacity(0.4))
            Image(systemName: "music.note")
                .font(.system(size: 60))
                .foregroundStyle(.white.opacity(0.6))
        }
    }
    
    private var trackInfoView: some View {
        VStack(spacing: 6) {
            Text(player.nowPlaying?.title ?? "Not Playing")
                .font(.title3.weight(.bold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .multilineTextAlignment(.center)
            
            Text(player.nowPlaying?.artist ?? "")
                .font(.body)
                .foregroundStyle(.white.opacity(0.7))
                .lineLimit(1)
        }
    }
    
    private struct CompactArtworkView: View {
        @EnvironmentObject private var player: PlayerStore
        
        var body: some View {
            AsyncImage(url: player.nowPlaying?.artworkURL ?? player.nowPlaying?.imageURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 60, height: 60)
                        .cornerRadius(8)
                case .failure(_), .empty:
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.gray.opacity(0.4))
                        .frame(width: 60, height: 60)
                        .overlay(
                            Image(systemName: "music.note")
                                .font(.system(size: 24))
                                .foregroundStyle(.white.opacity(0.6))
                        )
                @unknown default:
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.gray.opacity(0.4))
                        .frame(width: 60, height: 60)
                }
            }
        }
    }
    
    private var progressView: some View {
        VStack(spacing: 8) {
            GeometryReader { geometry in
                let width = geometry.size.width
                let progress = player.progress.isFinite ? max(0, min(1, player.progress)) : 0
                let dragProg = isDragging ? max(0, min(1, dragProgress)) : 0
                let displayProgress = isDragging ? dragProg : progress
                
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.25))
                        .frame(height: 4)
                    
                    Capsule()
                        .fill(Color.white)
                        .frame(width: max(0, width * displayProgress), height: 4)
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            isDragging = true
                            dragProgress = max(0, min(1, value.location.x / width))
                        }
                        .onEnded { value in
                            player.seekByProgress(max(0, min(1, value.location.x / width)))
                            isDragging = false
                        }
                )
            }
            .frame(height: 4)
            
            HStack {
                let currentDur = player.effectiveTotalDuration.isFinite ? player.effectiveTotalDuration : 0
                let currentTime = isDragging ? (dragProgress * currentDur) : player.currentTime
                Text(formatTime(currentTime.isFinite ? currentTime : 0))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.white.opacity(0.7))
                
                Spacer()
                
                let remaining = isDragging ? ((1 - dragProgress) * currentDur) : (currentDur - player.currentTime)
                Text("-\(formatTime(remaining.isFinite ? remaining : 0))")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
    }
    
    private var controlsView: some View {
        HStack(spacing: 0) {
            Button {
                player.toggleShuffle()
            } label: {
                Image(systemName: "shuffle")
                    .font(.title3)
                    .foregroundStyle(player.shuffleEnabled ? Color.accentColor : .white)
            }
            .frame(maxWidth: .infinity)
            
            Button {
                player.previous()
            } label: {
                Image(systemName: "backward.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            
            Button {
                player.togglePlayPause()
            } label: {
                ZStack {
                    Circle()
                        .fill(Color.white)
                        .frame(width: 64, height: 64)
                    
                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title)
                        .foregroundStyle(Color.black)
                }
            }
            .frame(maxWidth: .infinity)
            
            Button {
                player.next()
            } label: {
                Image(systemName: "forward.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .opacity(player.hasNext ? 1 : 0.4)
            
            Button {
                player.toggleRepeat()
            } label: {
                Image(systemName: player.repeatMode.icon)
                    .font(.title3)
                    .foregroundStyle(player.repeatMode.isActive ? Color.accentColor : .white)
            }
            .frame(maxWidth: .infinity)
        }
    }
    
    private var bottomActions: some View {
        HStack(spacing: 36) {
            if let track = player.nowPlaying {
                Button {
                    player.toggleLike(track)
                } label: {
                    Image(systemName: player.isLiked(track) ? "heart.fill" : "heart")
                        .font(.title2)
                        .foregroundStyle(player.isLiked(track) ? .red : .white)
                }
            }
            
            if let track = player.nowPlaying, !track.formattedPlaybackCount.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "play.fill")
                        .font(.caption2)
                    Text(track.formattedPlaybackCount)
                        .font(.caption)
                }
                .foregroundStyle(.white.opacity(0.7))
            }
            
            if let track = player.nowPlaying, !track.formattedLikesCount.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "heart.fill")
                        .font(.caption2)
                    Text(track.formattedLikesCount)
                        .font(.caption)
                }
                .foregroundStyle(.white.opacity(0.7))
            }
        }
    }
    
    private var lyricsView: some View {
        VStack {
            if lyricsLoading {
                ProgressView()
                    .tint(.white)
                    .padding()
            } else if let error = lyricsError {
                Text(error)
                    .foregroundStyle(.white.opacity(0.7))
                    .font(.subheadline)
                    .padding()
            } else if isSynced {
                syncedLyricsScrollView
            } else if let text = lyrics {
                plainLyricsView(text: text)
            }
        }
        .frame(maxHeight: 150)
    }
    
    private var syncedLyricsScrollView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(syncedLyrics.indices) { index in
                        let line = syncedLyrics[index]
                        Text(line.text)
                            .font(.body)
                            .foregroundStyle(activeLyricIndex == index ? .white : .white.opacity(0.4))
                            .fontWeight(activeLyricIndex == index ? .bold : .regular)
                            .id(index)
                    }
                }
                .padding()
            }
            .onChange(of: player.currentTime) { newTime, _ in
                updateActiveLyric(time: newTime)
            }
        }
    }
    
    @State private var activeLyricIndex: Int = -1
    
    private func plainLyricsView(text: String) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(text.components(separatedBy: "\n"), id: \.self) { line in
                    Text(line.isEmpty ? " " : line)
                        .font(.body)
                        .foregroundStyle(.white.opacity(0.7))
                }
            }
            .padding()
        }
    }
    
    private func updateActiveLyric(time: Double) {
        var newIndex = -1
        for (index, line) in syncedLyrics.enumerated() {
            if line.time <= time {
                newIndex = index
            } else {
                break
            }
        }
        if newIndex != activeLyricIndex {
            activeLyricIndex = newIndex
        }
    }
    
    private func loadLyrics() {
        guard let track = player.nowPlaying else { return }
        
        lyricsLoading = true
        lyricsError = nil
        
        let rawTitle = track.title
        let rawArtist = track.artist
        
        var artist: String
        var title: String
        
        if rawTitle.contains(" - ") {
            let parts = rawTitle.split(separator: "-")
            artist = String(parts[0].split(separator: "&").first ?? parts[0]).trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
            title = parts.count > 1 ? String(parts.dropFirst().joined(separator: "-")).trimmingCharacters(in: CharacterSet.whitespacesAndNewlines) : rawTitle
        } else {
            artist = rawArtist.split(separator: ",").first.map(String.init)?.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines) ?? rawArtist
            title = rawTitle
        }
        
        Task {
            do {
                if let result = try await lyricsService.fetchLyrics(artist: artist, title: title) {
                    await MainActor.run {
                        self.lyrics = result.lyrics
                        self.syncedLyrics = result.syncedLines
                        self.isSynced = result.isSynced
                        self.lyricsLoading = false
                    }
                } else {
                    await MainActor.run {
                        self.lyricsError = "Lyrics not found"
                        self.lyricsLoading = false
                    }
                }
            } catch {
                await MainActor.run {
                    self.lyricsError = error.localizedDescription
                    self.lyricsLoading = false
                }
            }
        }
    }
    
     private func formatTime(_ seconds: Double) -> String {
        guard seconds.isFinite && seconds >= 0 else { return "0:00" }
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }
    
    // MARK: - Helper Methods
    
    private func handleShare() {
        // Implement share functionality
        // For now, just print
        print("Share tapped")
    }
    
    private func handleDownload() {
        // Implement download functionality
        // For now, just print
        print("Download tapped")
    }
    
    @State private var showAddToPlaylist = false
    @State private var isDownloading = false
    @State private var isDownloaded = false
}

struct QueueView: View {
    @EnvironmentObject private var player: PlayerStore
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            List {
                if !player.queue.isEmpty {
                    Section("Up Next") {
                        ForEach(Array(player.queue.enumerated()), id: \.element.id) { index, track in
                            QueueRowView(
                                track: track,
                                isCurrentTrack: index == player.currentIndex,
                                onTap: { player.playTrack(at: index) }
                            )
                        }
                    }
                }
            }
            .navigationTitle("Queue")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

private struct QueueRowView: View {
    let track: Track
    let isCurrentTrack: Bool
    let onTap: () -> Void
    
    var body: some View {
        HStack {
            if isCurrentTrack {
                Image(systemName: "music.note")
                    .foregroundStyle(Color.accentColor)
            }
            
            VStack(alignment: .leading) {
                Text(track.title)
                    .font(.body)
                    .fontWeight(isCurrentTrack ? .semibold : .regular)
                Text(track.artist)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Text(track.durationText)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}