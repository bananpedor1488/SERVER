import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var playerStore = PlayerStore()
    @State private var showFullPlayer = false

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView {
                HomeView()
                    .tabItem { Label("Home", systemImage: "house") }

                SearchView()
                    .tabItem { Label("Search", systemImage: "magnifyingglass") }

                AccountView()
                    .tabItem { Label("Account", systemImage: "person") }
            }

            if playerStore.nowPlaying != nil {
                VStack(spacing: 0) {
                    Spacer()

                    MiniPlayerView(showFullPlayer: $showFullPlayer)
                        .padding(.bottom, 49)
                }
            }
        }
        .fullScreenCover(isPresented: $showFullPlayer) {
            FullPlayerView()
                .environmentObject(playerStore)
        }
        .sheet(isPresented: $auth.authSheetPresented) {
            AuthSheetView()
                .environmentObject(playerStore)
        }
        .environmentObject(playerStore)
    }
}
