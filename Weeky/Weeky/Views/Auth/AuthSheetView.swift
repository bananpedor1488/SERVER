import SwiftUI

struct AuthSheetView: View {
    @EnvironmentObject private var auth: AuthStore

    @State private var mode: Mode = .login
    @State private var loginId: String = ""
    @State private var email: String = ""
    @State private var username: String = ""
    @State private var password: String = ""

    @State private var loading: Bool = false
    @State private var errorMessage: String = ""

    enum Mode: String, CaseIterable {
        case login
        case register
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("Mode", selection: $mode) {
                    Text("Login").tag(Mode.login)
                    Text("Register").tag(Mode.register)
                }
                .pickerStyle(.segmented)

                if mode == .login {
                    TextField("Username or Email", text: $loginId)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } else {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                    TextField("Username", text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                SecureField("Password", text: $password)

                if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                }

                Button {
                    Task { await submit() }
                } label: {
                    if loading {
                        ProgressView()
                    } else {
                        Text(mode == .login ? "Login" : "Create account")
                    }
                }
                .disabled(loading)
            }
            .navigationTitle("Weeky")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        auth.authSheetPresented = false
                    }
                }
            }
        }
    }

    @MainActor
    private func submit() async {
        errorMessage = ""

        do {
            loading = true
            defer { loading = false }

            switch mode {
            case .login:
                let id = loginId.trimmingCharacters(in: .whitespacesAndNewlines)
                if id.isEmpty { throw APIError(message: "Email or Username required") }
                try await auth.login(login: id, password: password)

            case .register:
                let e = email.trimmingCharacters(in: .whitespacesAndNewlines)
                let u = username.trimmingCharacters(in: .whitespacesAndNewlines)
                if e.isEmpty { throw APIError(message: "Email required") }
                if u.isEmpty { throw APIError(message: "Username required") }
                try await auth.register(email: e, username: u, password: password)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
