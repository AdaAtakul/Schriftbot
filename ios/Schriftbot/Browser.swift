import SwiftUI
import WebKit
import UIKit

enum Tab: Hashable {
    case handwriting, claude
}

/// Hält beide Web-Ansichten und verbindet sie:
/// - Handschrift: die Web-App von GitHub Pages (offline über ihren Service Worker), mit Brücke zum Teilen-Menü.
/// - Claude: das echte claude.ai mit deinem normalen Login.
/// Kopierst du in Claude eine Antwort (Claudes Kopieren-Knopf), bietet die App an, sie in die Handschrift zu übernehmen.
@MainActor
final class Browser: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    static let appURL = URL(string: "https://deineschrift.de/")!
    static let claudeURL = URL(string: "https://claude.ai/new")!
    static let appHost = "deineschrift.de"
    private static let background = UIColor(red: 0.055, green: 0.059, blue: 0.075, alpha: 1)

    @Published var tab: Tab = .handwriting
    /// Aus Claude kopierter Text, der übernommen werden kann
    @Published var offer: String?
    /// Kurze Meldung unten (z. B. wenn die Seite nicht lädt)
    @Published var notice: String?

    let handwriting: WKWebView
    let claude: WKWebView
    private var pasteboardCount = UIPasteboard.general.changeCount
    private var bridge: Bridge?

    override init() {
        let hw = WKWebViewConfiguration()
        hw.limitsNavigationsToAppBoundDomains = true // nötig für Service Worker und die Brücke
        hw.allowsInlineMediaPlayback = true
        hw.userContentController.addUserScript(WKUserScript(
            source: "window.schriftbotNative = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        handwriting = WKWebView(frame: .zero, configuration: hw)

        let cl = WKWebViewConfiguration()
        cl.allowsInlineMediaPlayback = true
        claude = WKWebView(frame: .zero, configuration: cl)

        super.init()

        let bridge = Bridge(owner: self)
        self.bridge = bridge
        handwriting.configuration.userContentController.add(bridge, name: "schriftbot")

        for view in [handwriting, claude] {
            view.navigationDelegate = self
            view.uiDelegate = self
            view.isOpaque = false
            view.backgroundColor = Browser.background
            view.scrollView.backgroundColor = Browser.background
            view.allowsBackForwardNavigationGestures = view === claude
            if #available(iOS 16.4, *) { view.isInspectable = true }
        }
        handwriting.scrollView.bounces = false

        NotificationCenter.default.addObserver(
            self, selector: #selector(pasteboardChanged), name: UIPasteboard.changedNotification, object: nil)

        handwriting.load(URLRequest(url: Browser.appURL))
        claude.load(URLRequest(url: Browser.claudeURL))
    }

    // MARK: Claude → Handschrift

    @objc private func pasteboardChanged() {
        let board = UIPasteboard.general
        guard tab == .claude, board.changeCount != pasteboardCount else { return }
        pasteboardCount = board.changeCount
        guard board.hasStrings,
              let text = board.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else { return }
        offer = text
    }

    /// Übernommenen Text in die Handschrift-App setzen: mode "replace" oder "append"
    func insert(mode: String) {
        guard let text = offer else { return }
        offer = nil
        guard let json = try? JSONSerialization.data(withJSONObject: [text, mode]),
              let args = String(data: json, encoding: .utf8) else { return }
        let script = "typeof window.schriftbotInsert === 'function' ? (window.schriftbotInsert(...\(args)), true) : false"
        tab = .handwriting
        Task {
            // Das Skript gibt immer true/false zurück (nie undefined, das würde hier nicht ankommen)
            let done = (try? await handwriting.evaluateJavaScript(script)) as? Bool
            if done != true {
                notice = "Die Handschrift-App ist noch nicht aktualisiert. Der Text liegt in der Zwischenablage – im Tab „Schreiben“ einfügen."
            }
        }
    }

    func reload() {
        notice = nil
        (tab == .claude ? claude : handwriting).reload()
    }

    // MARK: Handschrift → Teilen-Menü (Export nach GoodNotes, Dateien …)

    func share(files: [[String: Any]]) {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("Export", isDirectory: true)
        try? FileManager.default.removeItem(at: dir)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var urls: [URL] = []
        for file in files {
            guard let name = file["name"] as? String,
                  let base64 = file["data"] as? String,
                  let data = Data(base64Encoded: base64) else { continue }
            let url = dir.appendingPathComponent(name.replacingOccurrences(of: "/", with: "-"))
            if (try? data.write(to: url)) != nil { urls.append(url) }
        }
        guard !urls.isEmpty, let top = Browser.topController() else { return }
        let sheet = UIActivityViewController(activityItems: urls, applicationActivities: nil)
        if let pop = sheet.popoverPresentationController {
            pop.sourceView = top.view
            pop.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.maxY - 90, width: 1, height: 1)
            pop.permittedArrowDirections = .down
        }
        top.present(sheet, animated: true)
    }

    static func topController() -> UIViewController? {
        let window = UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first
        var top = window?.rootViewController
        while let next = top?.presentedViewController { top = next }
        return top
    }

    // MARK: Navigation

    private static let claudeHosts = ["claude.ai", "anthropic.com", "claudeusercontent.com", "claude.com"]
    private static let loginHosts = ["accounts.google.com", "appleid.apple.com"]

    private static func host(_ url: URL, isIn list: [String]) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return list.contains { host == $0 || host.hasSuffix("." + $0) }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url else { return .allow }
        // Eingebettete Inhalte (z. B. Claude-Artifacts, Prüfseiten) immer zulassen
        if navigationAction.targetFrame?.isMainFrame == false { return .allow }
        if ["about", "blob", "data"].contains(url.scheme ?? "") { return .allow }

        if webView === handwriting {
            if url.host?.lowercased() == Browser.appHost { return .allow }
            if Browser.host(url, isIn: Browser.claudeHosts) { // Link zu Claude aus der Web-App
                claude.load(URLRequest(url: url))
                tab = .claude
                return .cancel
            }
            _ = await UIApplication.shared.open(url)
            return .cancel
        }

        // Claude-Fenster: claude.ai und Anmeldung bleiben hier, andere Links öffnen in Safari
        if Browser.host(url, isIn: Browser.claudeHosts + Browser.loginHosts) {
            return .allow
        }
        if url.scheme == "http" || url.scheme == "https" {
            _ = await UIApplication.shared.open(url)
            return .cancel
        }
        return .allow
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let code = (error as NSError).code
        guard code != NSURLErrorCancelled else { return }
        notice = webView === claude
            ? "Claude lädt nicht. Bist du online?"
            : "Die Handschrift-App lädt nicht. Beim ersten Start braucht sie Internet, danach geht sie offline."
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        notice = nil
    }

    // Links mit target="_blank": Claude-Seiten im selben Fenster, alles andere in Safari
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if Browser.host(url, isIn: Browser.claudeHosts + Browser.loginHosts) {
                claude.load(URLRequest(url: url))
                tab = .claude
            } else {
                UIApplication.shared.open(url)
            }
        }
        return nil
    }

    // JavaScript-Dialoge (alert/confirm) als iPad-Dialoge
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async {
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in done.resume() })
            guard let top = Browser.topController() else { return done.resume() }
            top.present(alert, animated: true)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async -> Bool {
        await withCheckedContinuation { (done: CheckedContinuation<Bool, Never>) in
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in done.resume(returning: false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in done.resume(returning: true) })
            guard let top = Browser.topController() else { return done.resume(returning: false) }
            top.present(alert, animated: true)
        }
    }
}

/// Nachrichten der Handschrift-App an die iPad-App (window.webkit.messageHandlers.schriftbot).
/// Eigene Klasse, damit das WKWebView das Browser-Objekt nicht festhält.
@MainActor
final class Bridge: NSObject, WKScriptMessageHandler {
    weak var owner: Browser?

    init(owner: Browser) {
        self.owner = owner
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        if action == "share", let files = body["files"] as? [[String: Any]] {
            owner?.share(files: files)
        }
    }
}
