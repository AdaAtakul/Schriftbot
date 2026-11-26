import SwiftUI
import WebKit

/// Zeigt ein vorhandenes WKWebView an. Die Web-Ansichten leben im Browser-Objekt weiter,
/// damit beim Tabwechsel nichts neu geladen wird (Claude-Chat und Handschrift bleiben, wo sie waren).
struct WebView: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
