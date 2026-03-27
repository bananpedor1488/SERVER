import Foundation

final class SongViewModel: ObservableObject {
    @Published var songs: [Song] = []
    @Published var errorMessage: String?
    @Published var isLoading: Bool = false

    private let api = APIClient()

    func fetchSongs(songType: SongType) {
        isLoading = true
        errorMessage = nil

        Task { @MainActor in
            do {
                let response: SearchResponse = try await api.requestJSON(
                    "/api/search",
                    queryParams: ["q": songType.rawValue],
                    decode: SearchResponse.self
                )
                self.songs = response.results.map { self.trackToSong($0) }
            } catch {
                self.errorMessage = error.localizedDescription
            }
            self.isLoading = false
        }
    }

    func fetchTrending() {
        isLoading = true
        errorMessage = nil

        Task { @MainActor in
            do {
                let response: SearchResponse = try await api.requestJSON(
                    "/api/search",
                    queryParams: ["q": "trending music"],
                    decode: SearchResponse.self
                )
                self.songs = response.results.map { self.trackToSong($0) }
            } catch {
                self.errorMessage = error.localizedDescription
            }
            self.isLoading = false
        }
    }

    func fetchPopular() {
        isLoading = true
        errorMessage = nil

        Task { @MainActor in
            do {
                let response: SearchResponse = try await api.requestJSON(
                    "/api/search",
                    queryParams: ["q": "popular songs"],
                    decode: SearchResponse.self
                )
                self.songs = response.results.map { self.trackToSong($0) }
            } catch {
                self.errorMessage = error.localizedDescription
            }
            self.isLoading = false
        }
    }

    private func trackToSong(_ track: Track) -> Song {
        print("DEBUG: Track - id: \(track.id), title: \(track.title)")
        print("DEBUG: streamUrl: \(track.streamUrl ?? "nil")")
        
        let audioURL = track.streamUrl ?? track.url ?? ""
        print("DEBUG: audioURL: \(audioURL)")
        
        return Song(
            id: track.id,
            videoURL: "",
            audioURL: audioURL,
            imageURL: track.thumbnail ?? "",
            imageLargeURL: track.artwork ?? track.thumbnail ?? "",
            isVideoPending: false,
            majorModelVersion: "",
            modelName: track.genre ?? "",
            isLiked: false,
            userID: track.artistId,
            displayName: track.artist,
            handle: track.artistId,
            isHandleUpdated: false,
            avatarImageURL: "",
            isTrashed: false,
            createdAt: "",
            status: "",
            title: track.title,
            playCount: track.playbackCount ?? 0,
            upvoteCount: track.likesCount ?? 0,
            isPublic: true
        )
    }
}
