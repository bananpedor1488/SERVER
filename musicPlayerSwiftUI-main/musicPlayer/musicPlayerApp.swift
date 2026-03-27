import SwiftUI

@main
struct musicPlayerApp: App {
    @StateObject private var authStore = AuthStore()
    @StateObject private var mediaPlayerState = MediaPlayerState()
    
    var body: some Scene {
        WindowGroup {
            TabBarView()
                .environmentObject(mediaPlayerState)
                .environmentObject(authStore)
        }
    }
}
