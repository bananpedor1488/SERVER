import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var player: PlayerStore
    @State private var searchText = ""
    @State private var searchResults: [Track] = []
    @State private var isSearching = false
    @State private var hasSearched = false

    private let api = APIClient()

    var body: some View {
        NavigationStack {
            Group {
                if searchText.isEmpty && !hasSearched {
                    ContentUnavailableView(
                        "Search",
                        systemImage: "magnifyingglass",
                        description: Text("Search for tracks, artists, or albums")
                    )
                } else if isSearching {
                    ProgressView("Searching...")
                } else if searchResults.isEmpty && hasSearched {
                    ContentUnavailableView(
                        "No Results",
                        systemImage: "magnifyingglass",
                        description: Text("No tracks found for \"\(searchText)\"")
                    )
                } else {
                    resultsList
                }
            }
            .navigationTitle("Search")
            .searchable(text: $searchText, prompt: "Search tracks...")
            .onChange(of: searchText) { _, newValue in
                performSearch(query: newValue)
            }
        }
    }

    private var resultsList: some View {
        List {
            ForEach(searchResults) { track in
                TrackRow(
                    track: track,
                    isLiked: player.isLiked(track),
                    onTap: {
                        player.play(track: track, from: searchResults)
                    },
                    onLike: {
                        player.toggleLike(track)
                    }
                )
            }
        }
        .listStyle(.plain)
    }

    private func performSearch(query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            searchResults = []
            hasSearched = false
            return
        }

        isSearching = true
        hasSearched = true

        Task {
            do {
                try await Task.sleep(nanoseconds: 300_000_000)
                if searchText == trimmed {
                    let response: SearchResponse = try await api.requestJSON(
                        "/api/search",
                        queryParams: ["q": trimmed],
                        decode: SearchResponse.self
                    )
                    searchResults = response.results
                }
            } catch {
                print("Search error: \(error)")
            }
            isSearching = false
        }
    }
}
