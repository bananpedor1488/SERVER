import Foundation
import SwiftUI

@MainActor
final class AuthStore: ObservableObject {
    struct User: Codable, Equatable {
        let id: String?
        let email: String?
        let username: String?
        let displayName: String?
        let bio: String?
        let avatar: String?
        let banner: String?
        let followersCount: Int?
        let followingCount: Int?
        let likesCount: Int?
        let playlistsCount: Int?
    }

    private struct LoginResponse: Codable {
        let success: Bool
        let token: String?
        let user: User?
        let error: String?
    }

    private struct MeResponse: Codable {
        let success: Bool
        let user: User?
        let error: String?
    }

    private struct RegisterResponse: Codable {
        let success: Bool
        let token: String?
        let user: User?
        let error: String?
    }

    private struct LikesResponse: Codable {
        let success: Bool
        let likes: [Track]?
        let error: String?
    }

    private struct PlaylistsResponse: Codable {
        let success: Bool
        let playlists: [PlaylistData]?
        let error: String?
    }

    private let keychainService = "weeky-auth"
    private let keychainAccount = "token"

    @Published private(set) var token: String
    @Published private(set) var me: User?
    @Published private(set) var likedTracks: [Track] = []
    @Published private(set) var userPlaylists: [PlaylistData] = []
    @Published var authSheetPresented: Bool = false

    private let api = APIClient()

    var isAuthenticated: Bool { !token.isEmpty }

    init() {
        token = KeychainService.readString(service: keychainService, account: keychainAccount) ?? ""
        Task { await refreshMeIfNeeded() }
    }

    func requireAuth() {
        if !isAuthenticated {
            authSheetPresented = true
        }
    }

    func login(login: String, password: String) async throws {
        let body = try JSONSerialization.data(withJSONObject: [
            "login": login,
            "password": password
        ], options: [])

        let resp = try await api.requestJSON("/api/auth/login", method: "POST", body: body, decode: LoginResponse.self)
        guard resp.success, let t = resp.token, !t.isEmpty else {
            throw APIError(message: resp.error ?? "Login failed")
        }

        token = t
        me = resp.user
        try? KeychainService.upsertString(t, service: keychainService, account: keychainAccount)
        authSheetPresented = false

        if me == nil {
            await refreshMeIfNeeded()
        }

        await loadLikedTracks()
    }

    func register(email: String, username: String, password: String) async throws {
        let body = try JSONSerialization.data(withJSONObject: [
            "email": email,
            "username": username,
            "password": password
        ], options: [])

        let resp = try await api.requestJSON("/api/auth/register", method: "POST", body: body, decode: RegisterResponse.self)
        guard resp.success, let t = resp.token, !t.isEmpty else {
            throw APIError(message: resp.error ?? "Register failed")
        }

        token = t
        me = resp.user
        try? KeychainService.upsertString(t, service: keychainService, account: keychainAccount)
        authSheetPresented = false

        if me == nil {
            await refreshMeIfNeeded()
        }

        await loadLikedTracks()
    }

    func logout() {
        token = ""
        me = nil
        likedTracks = []
        userPlaylists = []
        KeychainService.delete(service: keychainService, account: keychainAccount)
    }

    func refreshMeIfNeeded() async {
        guard !token.isEmpty else {
            me = nil
            return
        }

        do {
            let resp = try await api.requestJSON(
                "/api/auth/me",
                headers: ["Authorization": "Bearer \(token)"],
                decode: MeResponse.self
            )

            if resp.success {
                me = resp.user
            }
        } catch {
        }
    }

    func loadLikedTracks() async {
        guard let username = me?.username else { return }

        do {
            let resp = try await api.requestJSON(
                "/api/users/\(username)/likes",
                headers: authHeaders,
                decode: LikesResponse.self
            )

            if resp.success, let likes = resp.likes {
                likedTracks = likes
            }
        } catch {
        }
    }

    func loadUserPlaylists() async {
        guard let username = me?.username else { return }

        do {
            let resp = try await api.requestJSON(
                "/api/users/\(username)/playlists",
                headers: authHeaders,
                decode: PlaylistsResponse.self
            )

            if resp.success, let playlists = resp.playlists {
                userPlaylists = playlists
            }
        } catch {
        }
    }

    private var authHeaders: [String: String] {
        ["Authorization": "Bearer \(token)"]
    }
}

struct PlaylistData: Codable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let tracks: [Track]?
    let createdAt: String?
    let updatedAt: String?

    var trackCount: Int {
        tracks?.count ?? 0
    }

    var coverURL: URL? {
        guard let firstTrack = tracks?.first else { return nil }
        return firstTrack.artworkURL ?? firstTrack.imageURL
    }
}
