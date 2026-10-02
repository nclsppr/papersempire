import SwiftUI

@main
struct PapersEmpireApp: App {
    @State private var game = NativeGameStore()
    var body: some Scene {
        WindowGroup {
            NativeGameRootView(game: game)
                .onOpenURL { game.previewImport(from: $0) }
        }
    }
}
