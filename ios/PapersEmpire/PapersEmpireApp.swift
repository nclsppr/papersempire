import SwiftUI
import WebKit
import UniformTypeIdentifiers
import Observation

@main
struct PapersEmpireApp: App {
    @State private var session = GameSession()
    var body: some Scene {
        WindowGroup {
            GameRootView(session: session)
                .onOpenURL { session.importFile($0) }
        }
    }
}

private struct GameRootView: View {
    @Bindable var session: GameSession
    var body: some View {
        ZStack {
            Color(red: 0.027, green: 0.067, blue: 0.122).ignoresSafeArea()
            GameWebView(session: session).ignoresSafeArea()
            if session.loading {
                VStack(spacing: 20) {
                    Image("AppMark").resizable().scaledToFit().frame(width: 100, height: 100)
                    Text("Papers Empire").font(.title2.bold()).foregroundStyle(.white)
                    ProgressView().tint(.white).accessibilityLabel(Text(NativeCopy.loading))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(red: 0.027, green: 0.067, blue: 0.122))
            }
        }
        .preferredColorScheme(.dark)
        // Downloads and third-party providers can label .papersempire as
        // generic data. Validate the bounded file contents after selection;
        // a provider's cached UTI must not prevent an otherwise valid import.
        .fileImporter(isPresented: $session.showImporter, allowedContentTypes: [.data], allowsMultipleSelection: false) { result in
            switch result {
            case .success(let files): if let file = files.first { session.importFile(file) }
            case .failure(let error): session.errorMessage = error.localizedDescription
            }
        }
        .sheet(item: $session.share) { item in
            ShareSheet(items: item.items).presentationDetents([.medium, .large])
        }
        .alert("Papers Empire", isPresented: Binding(get: { session.errorMessage != nil }, set: { if !$0 { session.errorMessage = nil } })) {
            Button("OK") { session.errorMessage = nil }
        } message: { Text(session.errorMessage ?? "") }
    }
}

private struct ShareItem: Identifiable {
    let id = UUID()
    let items: [Any]
}

@MainActor @Observable
private final class GameSession {
    var loading = true
    var showImporter = false
    var errorMessage: String?
    var share: ShareItem?
    weak var webView: WKWebView?
    private var pendingImport: String?
    private let saveByteLimit = NativeGamePolicy.saveByteLimit
    let preferences: NativeGamePreferences

    init() {
        #if DEBUG
        preferences = NativeGamePreferences(directory: ProcessInfo.processInfo.arguments.contains("--ephemeral-test") ? nil : NativeGamePreferences.defaultDirectory)
        #else
        preferences = NativeGamePreferences()
        #endif
    }

    func importFile(_ url: URL) {
        guard url.isFileURL else { return }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
            guard values.isRegularFile == true, let size = values.fileSize, size <= saveByteLimit else { throw TransferError.invalidFile }
            let data = try Data(contentsOf: url, options: .mappedIfSafe)
            guard NativeGamePolicy.acceptsSave(data), let raw = String(data: data, encoding: .utf8) else { throw TransferError.invalidFile }
            pendingImport = raw
            deliverPendingImport()
        } catch { errorMessage = error.localizedDescription }
    }

    func didLoad(_ url: URL?) {
        if let url { _ = try? preferences.recordLoadedPage(url) }
        loading = false
        deliverPendingImport()
    }

    private func deliverPendingImport() {
        guard !loading, let raw = pendingImport, let webView else { return }
        // callAsyncJavaScript binds the file as a value; imported text is never code.
        webView.callAsyncJavaScript("if (!window.PESaveTransfer) return false; window.PEEmpireView?.closePanel(); window.PESaveTransfer.previewImport(raw); return true;", arguments: ["raw": raw], in: nil, in: .page) { [weak self] result in
            switch result {
            case .success(let handled): if handled as? Bool == true { self?.pendingImport = nil }
            case .failure(let error): self?.errorMessage = error.localizedDescription
            }
        }
    }

    func receive(_ body: [String: Any]) {
        guard let action = body["action"] as? String else { return }
        switch action {
        case "requestImport", "importSave": showImporter = true
        case "exportSave":
            guard let raw = body["payload"] as? String, let data = raw.data(using: .utf8), data.count <= saveByteLimit else { return }
            do {
                _ = try JSONSerialization.jsonObject(with: data)
                let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("Saves", isDirectory: true)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let destination = directory.appendingPathComponent("papers-empire-\(UUID().uuidString.prefix(8)).papersempire")
                try data.write(to: destination, options: .atomic)
                share = ShareItem(items: [destination])
            } catch { errorMessage = error.localizedDescription }
        case "shareCard":
            guard let payload = body["payload"] as? String, payload.hasPrefix("data:image/png;base64,"), payload.utf8.count <= 16 * 1024 * 1024,
                  let data = Data(base64Encoded: String(payload.dropFirst("data:image/png;base64,".count))), data.count <= 12 * 1024 * 1024,
                  let picture = UIImage(data: data), picture.size.width <= 4096, picture.size.height <= 4096 else { return }
            var items: [Any] = [picture]
            if let text = body["text"] as? String, text.count <= 2000 { items.append(text) }
            if let value = body["url"] as? String, let url = URL(string: value), url.scheme == "https", url.host == "papersempire.com" { items.append(url) }
            share = ShareItem(items: items)
        case "haptic":
            if body["style"] as? String == "success" { UINotificationFeedbackGenerator().notificationOccurred(.success) }
            else { UIImpactFeedbackGenerator(style: .light).impactOccurred(intensity: 0.55) }
        default: break
        }
    }
}

private enum TransferError: LocalizedError {
    case invalidFile
    var errorDescription: String? { NativeCopy.invalidFile }
}

private enum NativeCopy {
    static var language: String { NativeGamePreferences().language ?? String((Locale.preferredLanguages.first ?? "fr").prefix(2)) }
    static var loading: String { ["fr": "Chargement de ton empire", "en": "Loading your empire", "de": "Dein Imperium wird geladen", "lb": "Däin Imperium gëtt gelueden"][language] ?? "Loading your empire" }
    static var invalidFile: String { [
        "fr": "Choisis une sauvegarde Papers Empire de moins de 2 Mo. Ta partie actuelle n’a pas été modifiée.",
        "en": "Choose a Papers Empire save file smaller than 2 MB. Your current game has not been changed.",
        "de": "Wähle einen Papers-Empire-Spielstand unter 2 MB. Dein aktuelles Spiel wurde nicht verändert.",
        "lb": "Wiel e Papers-Empire-Spillstand ënner 2 MB. Däin aktuellt Spill gouf net geännert."
    ][language] ?? "Choose a Papers Empire save file smaller than 2 MB. Your current game has not been changed." }
    static var unavailablePage: String { [
        "fr": "Cette page n’est pas disponible dans l’app. Pour explorer ta partie dans la Data Science Zone du site, exporte-la puis importe-la dans le navigateur.",
        "en": "This page is not available in the app. To explore your game in the website’s Data Science Zone, export it and then import it in your browser.",
        "de": "Diese Seite ist in der App nicht verfügbar. Exportiere deinen Spielstand und importiere ihn im Browser, um ihn in der Data Science Zone der Website zu erkunden.",
        "lb": "Dës Säit ass net an der App disponibel. Exportéier däi Spillstand an importéier en am Browser, fir en an der Data Science Zone vun der Websäit ze entdecken."
    ][language] ?? "This page is not available in the app. Export your game and import it in your browser to use the website’s Data Science Zone." }
}

private struct GameWebView: UIViewRepresentable {
    let session: GameSession
    func makeCoordinator() -> Coordinator { Coordinator(session: session) }
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        #if DEBUG
        // QA can start an isolated run without ever replacing a personal save.
        configuration.websiteDataStore = ProcessInfo.processInfo.arguments.contains("--ephemeral-test") ? .nonPersistent() : .default()
        #else
        configuration.websiteDataStore = .default()
        #endif
        configuration.setURLSchemeHandler(BundledGameHandler(), forURLScheme: "peapp")
        configuration.userContentController.add(context.coordinator, name: "papersNative")
        configuration.userContentController.addUserScript(WKUserScript(source: "window.__PE_NATIVE__ = Object.freeze({ platform: 'ios', version: 1 });", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        view.isOpaque = false
        view.backgroundColor = UIColor(red: 0.027, green: 0.067, blue: 0.122, alpha: 1)
        view.scrollView.backgroundColor = view.backgroundColor
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.scrollView.bounces = false
        view.allowsBackForwardNavigationGestures = false
        #if DEBUG
        view.isInspectable = true
        #endif
        session.webView = view
        let language = session.preferences.language ?? Locale.preferredLanguages.first.map { String($0.prefix(2)) } ?? "fr"
        view.load(URLRequest(url: NativeGamePolicy.startURL(language: language)))
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let session: GameSession
        init(session: GameSession) { self.session = session }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard NativeGamePolicy.acceptsBridgeOrigin(message.frameInfo.request.url, isMainFrame: message.frameInfo.isMainFrame), let body = message.body as? [String: Any] else { return }
            session.receive(body)
        }
        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { session.loading = true }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { session.didLoad(webView.url) }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { session.loading = false; session.errorMessage = error.localizedDescription }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { session.loading = false; session.errorMessage = error.localizedDescription }
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { session.loading = true; webView.reload() }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            if NativeGamePolicy.acceptsBridgeOrigin(url, isMainFrame: true) {
                if NativeGamePolicy.language(for: url) != nil { decisionHandler(.allow); return }
                if navigationAction.navigationType == .linkActivated {
                    if let helpURL = NativeGamePolicy.publicGuideURL(for: url) { UIApplication.shared.open(helpURL) }
                    else { session.errorMessage = NativeCopy.unavailablePage }
                }
                decisionHandler(.cancel); return
            }
            if ["https", "http"].contains(url.scheme ?? ""), navigationAction.navigationType == .linkActivated { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }
        private func present(_ alert: UIAlertController) {
            let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
            var controller = scene?.windows.first { $0.isKeyWindow }?.rootViewController
            while let next = controller?.presentedViewController { controller = next }
            controller?.present(alert, animated: true)
        }
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: "Papers Empire", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }); present(alert)
        }
        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let alert = UIAlertController(title: "Papers Empire", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: NSLocalizedString("Cancel", comment: ""), style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) }); present(alert)
        }
        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
            let alert = UIAlertController(title: "Papers Empire", message: prompt, preferredStyle: .alert)
            alert.addTextField { $0.text = defaultText }
            alert.addAction(UIAlertAction(title: NSLocalizedString("Cancel", comment: ""), style: .cancel) { _ in completionHandler(nil) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(alert.textFields?.first?.text) }); present(alert)
        }
    }
}

/// Loads the same HTML/CSS/JavaScript from the signed bundle. No network server is required.
private final class BundledGameHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url,
              let root = Bundle.main.resourceURL?.appendingPathComponent("WebAssets", isDirectory: true),
              let file = NativeGamePolicy.resourceURL(for: requestURL, root: root) else {
            urlSchemeTask.didFailWithError(URLError(.badURL)); return
        }
        do {
            let data = try Data(contentsOf: file, options: .mappedIfSafe)
            let mime: String
            switch file.pathExtension.lowercased() {
            case "js", "mjs": mime = "text/javascript"
            case "css": mime = "text/css"
            case "html": mime = "text/html"
            case "webmanifest", "json": mime = "application/json"
            case "svg": mime = "image/svg+xml"
            case "webp": mime = "image/webp"
            default: mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            }
            urlSchemeTask.didReceive(URLResponse(url: requestURL, mimeType: mime, expectedContentLength: data.count, textEncodingName: mime.hasPrefix("text/") ? "utf-8" : nil))
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch { urlSchemeTask.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) { /* Reads finish synchronously; no pending work to cancel. */ }
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
