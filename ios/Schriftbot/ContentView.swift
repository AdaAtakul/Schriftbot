import SwiftUI

struct ContentView: View {
    @StateObject private var browser = Browser()

    var body: some View {
        TabView(selection: $browser.tab) {
            WebView(webView: browser.handwriting)
                .tabItem { Label("Handschrift", systemImage: "pencil.tip") }
                .tag(Tab.handwriting)
            WebView(webView: browser.claude)
                .tabItem { Label("Claude", systemImage: "sparkles") }
                .tag(Tab.claude)
        }
        .overlay(alignment: .bottom) {
            VStack(spacing: 10) {
                if let text = browser.offer {
                    OfferCard(text: text,
                              replace: { browser.insert(mode: "replace") },
                              append: { browser.insert(mode: "append") },
                              dismiss: { browser.offer = nil })
                }
                if let notice = browser.notice {
                    NoticeCard(text: notice, retry: { browser.reload() }, dismiss: { browser.notice = nil })
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 74)
            .frame(maxWidth: 620)
            .animation(.easeOut(duration: 0.25), value: browser.offer)
            .animation(.easeOut(duration: 0.25), value: browser.notice)
        }
        .preferredColorScheme(.dark)
        .tint(Color(red: 0.44, green: 0.49, blue: 1.0))
    }
}

/// Angebot nach dem Kopieren in Claude: Vorschau, dann Ersetzen oder Anhängen
struct OfferCard: View {
    let text: String
    let replace: () -> Void
    let append: () -> Void
    let dismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("In deine Handschrift übernehmen?", systemImage: "pencil.line")
                    .font(.headline)
                Spacer()
                Button(action: dismiss) {
                    Image(systemName: "xmark").font(.body.weight(.semibold))
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .accessibilityLabel("Verwerfen")
            }
            Text(text)
                .font(.callout)
                .lineLimit(4)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 10) {
                Button(action: replace) {
                    Text("Text ersetzen").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                Button(action: append) {
                    Text("Anhängen").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            .controlSize(.large)
        }
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .black.opacity(0.4), radius: 24, y: 10)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}

struct NoticeCard: View {
    let text: String
    let retry: () -> Void
    let dismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark")
            Text(text).font(.callout).frame(maxWidth: .infinity, alignment: .leading)
            Button("Neu laden", action: retry).buttonStyle(.bordered)
            Button(action: dismiss) { Image(systemName: "xmark") }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .accessibilityLabel("Schließen")
        }
        .padding(14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}
