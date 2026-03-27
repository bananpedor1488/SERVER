import Foundation

struct APIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

public struct APIClient {
    var baseURL: URL = AppConfig.apiBaseURL
    var urlSession: URLSession = .shared

    func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        headers: [String: String] = [:],
        queryParams: [String: String]? = nil,
        body: Data? = nil,
        decode: T.Type
    ) async throws -> T {
        var url = baseURL.appendingPathComponent(path.hasPrefix("/") ? String(path.dropFirst()) : path)
        
        if let params = queryParams, !params.isEmpty {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
            if let newURL = components?.url {
                url = newURL
            }
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.httpBody = body

        var allHeaders = headers
        if body != nil {
            allHeaders["Content-Type"] = allHeaders["Content-Type"] ?? "application/json"
        }
        allHeaders.forEach { req.setValue($0.value, forHTTPHeaderField: $0.key) }

        let (data, resp) = try await urlSession.data(for: req)
        guard let http = resp as? HTTPURLResponse else {
            throw APIError(message: "Invalid server response")
        }

        if !(200...299).contains(http.statusCode) {
            let serverMsg = String(data: data, encoding: .utf8)
            throw APIError(message: serverMsg?.isEmpty == false ? serverMsg! : "HTTP \(http.statusCode)")
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError(message: "Failed to decode response: \(error.localizedDescription)")
        }
    }

    func requestJSON<T: Decodable>(
        _ path: String,
        method: String = "GET",
        headers: [String: String] = [:],
        queryParams: [String: String]? = nil,
        body: Data? = nil,
        decode: T.Type
    ) async throws -> T {
        try await request(path, method: method, headers: headers, queryParams: queryParams, body: body, decode: decode)
    }

    func streamURL(from urlString: String) -> URL? {
        URL(string: urlString)
    }
}
