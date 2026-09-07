import SpriteKit
import SwiftUI
import UIKit

/// Only durable ownership enters the diorama. Scenery never creates game units.
struct EmpireLot: Equatable, Sendable {
    let id: String
    let quantity: Int
    let unlocked: Bool
}

@MainActor
final class EmpireScene: SKScene {
    var onSelectLot: ((String) -> Void)?
    fileprivate var onViewportChange: (() -> Void)?

    private static let ids = [
        "reproOperator", "reproWorkshop", "digitalPress", "offsetPress",
        "clientPortal", "finishingWorkshop", "insertingLine", "logistics",
        "comBridge", "prepressStudio", "factory40", "pampyAI"
    ]
    private let world = SKNode()
    private let landscape = SKNode()
    private let life = SKNode()
    private let viewpoint = SKCameraNode()
    private var lots: [EmpireLot] = []
    private var drawings: [String: EmpireLotNode] = [:]
    private var textures: [String: SKTexture] = [:]
    private var rendered: [String: EmpireLot] = [:]
    private var layoutColumns = 0
    private var reducedMotion = false
    private var cameraIsManual = false
    private var selectedID: String?
    private var contentInsets = UIEdgeInsets(top: 140, left: 16, bottom: 120, right: 16)
    private var lifeSignature = ""
    private var lastAccessibilityUpdate: TimeInterval = 0
    private var lastCameraPosition = CGPoint.zero
    private var lastCameraScale: CGFloat = 0
    private var lastQuantityScale: CGFloat = 0
    private var quantityFont = UIFont.systemFont(ofSize: 14, weight: .semibold)
    private var terrainBounds = CGRect.zero

    init(viewportSize: CGSize = CGSize(width: 390, height: 844)) {
        super.init(size: viewportSize)
        scaleMode = .resizeFill
        backgroundColor = Self.color(0xEDE7D7)
        anchorPoint = CGPoint(x: 0.5, y: 0.5)
        addChild(world)
        world.addChild(landscape)
        world.addChild(life)
        landscape.accessibilityElementsHidden = true
        life.accessibilityElementsHidden = true
        addChild(viewpoint)
        camera = viewpoint
        isUserInteractionEnabled = false // UIKit recognizers retain native gesture arbitration.
    }

    required init?(coder aDecoder: NSCoder) { nil }

    override func didMove(to view: SKView) {
        updateQuantityTypography(compatibleWith: view.traitCollection)
        ensureLayout()
        if !cameraIsManual { frameVisibleLots(animated: false) }
    }

    override func didChangeSize(_ oldSize: CGSize) {
        guard size.width > 0, size.height > 0 else { return }
        let changed = layoutColumns != columns
        ensureLayout()
        if changed { cameraIsManual = false }
        if !cameraIsManual { frameVisibleLots(animated: false) }
        onViewportChange?()
    }

    func updateLots(_ values: [EmpireLot]) {
        let lookup = Dictionary(values.map { ($0.id, $0) }, uniquingKeysWith: { _, latest in latest })
        let normalized = Self.ids.compactMap { id -> EmpireLot? in
            guard let value = lookup[id] else { return nil }
            return EmpireLot(id: id, quantity: max(0, value.quantity), unlocked: value.unlocked)
        }
        guard normalized != lots || layoutColumns == 0 else { return }
        let formerVisible = Set(lots.filter { $0.quantity > 0 || $0.unlocked }.map(\.id))
        lots = normalized
        ensureLayout()
        redrawLots()
        refreshLife()
        let nowVisible = Set(lots.filter { $0.quantity > 0 || $0.unlocked }.map(\.id))
        if formerVisible != nowVisible && !cameraIsManual { frameVisibleLots(animated: !formerVisible.isEmpty) }
        onViewportChange?()
    }

    func setReducedMotion(_ value: Bool) {
        guard reducedMotion != value else { return }
        reducedMotion = value
        if value {
            viewpoint.removeAllActions()
            for node in drawings.values { node.removeAllActions(); node.setScale(1) }
        }
        lifeSignature = ""
        refreshLife()
    }

    func focusLot(_ id: String) {
        guard let point = lotPosition(id), drawings[id] != nil else { return }
        selectedID = id
        updateSelection()
        cameraIsManual = true
        moveCamera(to: cameraCentre(for: CGPoint(x: point.x, y: point.y + 65), scale: 0.9), scale: 0.9, animated: true)
    }

    func recenter() {
        cameraIsManual = false
        selectedID = nil
        updateSelection()
        frameVisibleLots(animated: true)
    }

    func zoom(by factor: CGFloat) {
        zoom(by: factor, at: CGPoint(x: size.width / 2, y: size.height / 2))
    }

    fileprivate func setContentInsets(_ value: UIEdgeInsets) {
        guard contentInsets != value else { return }
        contentInsets = value
        if !cameraIsManual { frameVisibleLots(animated: false) }
    }

    fileprivate func beginCameraGesture() {
        cameraIsManual = true
        viewpoint.removeAllActions()
    }

    fileprivate func pan(by translation: CGPoint) {
        beginCameraGesture()
        viewpoint.position.x -= translation.x * viewpoint.xScale
        viewpoint.position.y += translation.y * viewpoint.yScale
        constrainCamera()
        onViewportChange?()
    }

    fileprivate func zoom(by factor: CGFloat, at viewPoint: CGPoint) {
        guard factor.isFinite, factor > 0 else { return }
        beginCameraGesture()
        let anchor = convertPoint(fromView: viewPoint)
        viewpoint.setScale(min(3.5, max(0.48, viewpoint.xScale / factor)))
        let movedAnchor = convertPoint(fromView: viewPoint)
        viewpoint.position.x += anchor.x - movedAnchor.x
        viewpoint.position.y += anchor.y - movedAnchor.y
        constrainCamera()
        onViewportChange?()
    }

    fileprivate func select(at viewPoint: CGPoint) {
        let point = convertPoint(fromView: viewPoint)
        // First prefer the visible illustration, then a 44-point minimum target
        // around the parcel. Transparent texture margins do not steal other lots.
        let candidates = lots.filter { $0.quantity > 0 || $0.unlocked }.compactMap { lot -> (String, CGFloat)? in
            guard let position = lotPosition(lot.id) else { return nil }
            let centre = CGPoint(x: position.x, y: position.y + (lot.quantity > 0 ? 65 : 0))
            let dx = point.x - centre.x, dy = point.y - centre.y
            let radius = max(22 * viewpoint.xScale, lot.quantity > 0 ? 102 : 72)
            guard abs(dx) <= radius, abs(dy) <= radius else { return nil }
            return (lot.id, hypot(dx, dy))
        }
        guard let id = candidates.min(by: { $0.1 < $1.1 })?.0 else { return }
        _ = activateLot(id)
    }

    private func activateLot(_ id: String) -> Bool {
        guard lots.contains(where: { $0.id == id && ($0.quantity > 0 || $0.unlocked) }),
              let onSelectLot else { return false }
        selectedID = id
        updateSelection()
        onSelectLot(id)
        return true
    }

    private func accessibilityFrame(for id: String) -> CGRect {
        guard let view, view.bounds.width >= 44, view.bounds.height >= 44,
              let lot = lots.first(where: { $0.id == id }), let point = lotPosition(id) else { return .zero }
        let centre = convertPoint(toView: CGPoint(x: point.x, y: point.y + (lot.quantity > 0 ? 58 : 0)))
        let side = max(44, 112 / viewpoint.xScale)
        let proposed = CGRect(x: centre.x - side / 2, y: centre.y - side / 2, width: side, height: side)
        let visible = proposed.intersection(view.bounds)
        guard !visible.isNull, !visible.isEmpty else { return .zero }
        let width = min(view.bounds.width, max(44, visible.width))
        let height = min(view.bounds.height, max(44, visible.height))
        let frame = CGRect(
            x: min(view.bounds.maxX - width, max(view.bounds.minX, visible.midX - width / 2)),
            y: min(view.bounds.maxY - height, max(view.bounds.minY, visible.midY - height / 2)),
            width: width, height: height)
        return UIAccessibility.convertToScreenCoordinates(frame, in: view)
    }

    fileprivate func updateAccessibility(names: [String: String]) {
        // Expose the actual parcel nodes through SpriteKit's native traversal,
        // with no parallel SKView array of UIAccessibilityElement objects.
        for lot in lots {
            guard let node = drawings[lot.id] else { continue }
            node.accessibilityLabel = names[lot.id] ?? lot.id
            node.accessibilityValue = String(lot.quantity)
            node.accessibilityTraits = .button
            node.accessibilityIdentifier = "native.lot." + lot.id
            node.isAccessibilityElement = !accessibilityFrame(for: lot.id).isEmpty
        }
    }

    override func update(_ currentTime: TimeInterval) {
        // Accessibility geometry follows camera easing without adding a per-node
        // simulation. All ambient motion is carried by bounded SpriteKit actions.
        if viewpoint.xScale != lastQuantityScale { updateQuantityScale() }
        guard currentTime - lastAccessibilityUpdate > 0.2 else { return }
        if viewpoint.position != lastCameraPosition || viewpoint.xScale != lastCameraScale {
            lastCameraPosition = viewpoint.position
            lastCameraScale = viewpoint.xScale
            lastAccessibilityUpdate = currentTime
            onViewportChange?()
        }
    }

    private var columns: Int {
        if size.width > size.height * 1.12 { return 6 }
        return size.height < 700 || size.width > 700 ? 4 : 3
    }

    private func lotPosition(_ id: String) -> CGPoint? {
        guard let index = Self.ids.firstIndex(of: id) else { return nil }
        let count = max(1, layoutColumns)
        let row = index / count, column = index % count
        let rows = Int(ceil(Double(Self.ids.count) / Double(count)))
        let stagger: [CGFloat] = [-9, 12, -6, 6]
        let rise: [CGFloat] = [-8, 14, 0, 10, -4, 9]
        return CGPoint(
            x: (CGFloat(column) - CGFloat(count - 1) / 2) * 200 + stagger[row % stagger.count],
            y: (CGFloat(rows - 1) / 2 - CGFloat(row)) * 214 + rise[column % rise.count]
        )
    }

    private func ensureLayout() {
        guard layoutColumns != columns else { return }
        layoutColumns = columns
        landscape.removeAllChildren()
        life.removeAllChildren()
        for node in drawings.values { node.removeFromParent() }
        drawings.removeAll()
        rendered.removeAll()
        buildTerrain()
        redrawLots()
        lifeSignature = ""
        refreshLife()
    }

    private func buildTerrain() {
        let rows = Int(ceil(Double(Self.ids.count) / Double(layoutColumns)))
        let width = CGFloat(layoutColumns - 1) * 200 + 348
        let height = CGFloat(rows - 1) * 214 + 416
        terrainBounds = CGRect(x: -width / 2, y: -height / 2, width: width, height: height)
        landscape.zPosition = -2000

        let island = CGPath(roundedRect: terrainBounds, cornerWidth: 86, cornerHeight: 62, transform: nil)
        let bankShadow = shape(island, fill: 0xB8B49E)
        bankShadow.position.y = -14
        landscape.addChild(bankShadow)
        let ground = shape(island, fill: 0xE3DFCA, stroke: 0xF9F3E2, width: 2)
        landscape.addChild(ground)

        // A curved water edge and stone quay give the miniature a real setting.
        // They are scenery, independent of every ownership and unlock decision.
        let riverX = width / 2 - 34
        let river = CGMutablePath()
        river.move(to: CGPoint(x: riverX + 44, y: height / 2 + 300))
        river.addCurve(to: CGPoint(x: riverX + 14, y: -height / 2 - 280),
                       control1: CGPoint(x: riverX - 62, y: height / 4),
                       control2: CGPoint(x: riverX + 95, y: -height / 3))
        landscape.addChild(line(river, color: 0xBEB999, width: 110))
        landscape.addChild(line(river, color: 0xF3EDD8, width: 95))
        landscape.addChild(line(river, color: 0x78A5A4, width: 78))
        let current = line(river, color: 0x527D87, width: 29)
        current.alpha = 0.38
        landscape.addChild(current)

        // Delivery routes sit between rows; a continuous boulevard connects them.
        for row in 0..<max(1, rows - 1) {
            let y = (CGFloat(rows - 1) / 2 - CGFloat(row) - 0.5) * 214 - 24
            let route = CGMutablePath()
            route.move(to: CGPoint(x: -width / 2 + 26, y: y - 13))
            route.addCurve(to: CGPoint(x: riverX - 66, y: y + 10),
                           control1: CGPoint(x: -width / 5, y: y + 4),
                           control2: CGPoint(x: width / 5, y: y - 4))
            landscape.addChild(line(route, color: 0xC7C3AB, width: 42))
            landscape.addChild(line(route, color: 0xF4EDD9, width: 35))
            let centre = line(route, color: 0xB8B59E, width: 1)
            centre.alpha = 0.6
            landscape.addChild(centre)
        }
        let boulevard = CGMutablePath()
        boulevard.move(to: CGPoint(x: -width / 2 + 62, y: -height / 2 + 42))
        boulevard.addCurve(to: CGPoint(x: -width / 2 + 65, y: height / 2 - 48),
                           control1: CGPoint(x: -width / 2 + 29, y: -height / 6),
                           control2: CGPoint(x: -width / 2 + 83, y: height / 5))
        landscape.addChild(line(boulevard, color: 0xC7C3AB, width: 38))
        landscape.addChild(line(boulevard, color: 0xF7EED9, width: 31))

        // Finite, deterministic decorative planting: no generated busy skyline.
        for index in 0..<14 {
            let onRight = index % 3 == 0
            let x = onRight ? riverX - 48 : -width / 2 + 23 + CGFloat(index % 2) * 20
            let y = -height / 2 + 72 + CGFloat(index) / 13 * (height - 160)
            let tree = treeNode(variant: index % 3)
            tree.position = CGPoint(x: x, y: y)
            tree.zPosition = 20
            landscape.addChild(tree)
        }
        for index in 0..<7 {
            let bollard = SKShapeNode(ellipseOf: CGSize(width: 7, height: 4))
            bollard.fillColor = Self.color(0x5B7777)
            bollard.strokeColor = .clear
            bollard.position = CGPoint(x: riverX - 28, y: CGFloat(index - 3) * 98)
            landscape.addChild(bollard)
        }
    }

    private func redrawLots() {
        for lot in lots {
            let shouldShow = lot.quantity > 0 || lot.unlocked
            if !shouldShow {
                drawings.removeValue(forKey: lot.id)?.removeFromParent()
                rendered.removeValue(forKey: lot.id)
                continue
            }
            guard rendered[lot.id] != lot, let position = lotPosition(lot.id) else { continue }
            let previous = rendered[lot.id]
            drawings[lot.id]?.removeFromParent()
            let node = makeLot(lot)
            node.name = "lot:" + lot.id
            node.position = position
            node.zPosition = 1000 - position.y
            world.addChild(node)
            drawings[lot.id] = node
            rendered[lot.id] = lot
            if let previous, lot.quantity > previous.quantity, !reducedMotion {
                node.setScale(0.95)
                let settle = SKAction.scale(to: 1, duration: 0.28)
                settle.timingMode = .easeOut
                node.run(settle)
            }
        }
        let currentIDs = Set(lots.map(\.id))
        for id in Array(drawings.keys) where !currentIDs.contains(id) {
            drawings.removeValue(forKey: id)?.removeFromParent()
            rendered.removeValue(forKey: id)
        }
        updateSelection()
    }

    private func makeLot(_ lot: EmpireLot) -> EmpireLotNode {
        let node = EmpireLotNode()
        node.frameProvider = { [weak self] in self?.accessibilityFrame(for: lot.id) ?? .zero }
        node.activate = { [weak self] in self?.activateLot(lot.id) ?? false }
        let stage = lot.quantity >= 25 ? 3 : lot.quantity >= 10 ? 2 : 1
        let padPath = diamond(width: 182, height: 88)
        let padShadow = shape(padPath, fill: 0x9F9F89)
        padShadow.position.y = -7
        padShadow.alpha = 0.36
        node.addChild(padShadow)
        let pad = shape(padPath, fill: lot.quantity == 0 ? 0xE9E2CA : stage == 3 ? 0xECE2C3 : 0xF5EBD6,
                        stroke: stage == 3 ? 0xD4BC87 : 0xFFF9EA, width: 2)
        node.addChild(pad)
        let selection = SKShapeNode(path: diamond(width: 192, height: 94))
        selection.name = "selection"
        selection.strokeColor = Self.color(0xDF8850)
        selection.fillColor = .clear
        selection.lineWidth = 3
        selection.alpha = 0
        node.addChild(selection)

        if lot.quantity == 0 {
            let border = SKShapeNode(path: padPath.copy(dashingWithPhase: 0, lengths: [7, 6]))
            border.strokeColor = Self.color(0xB7A174)
            border.fillColor = .clear
            border.lineWidth = 1.5
            node.addChild(border)
            for point in [CGPoint(x: -70, y: 0), CGPoint(x: 70, y: 0), CGPoint(x: 0, y: 32), CGPoint(x: 0, y: -32)] {
                let stake = SKShapeNode(rectOf: CGSize(width: 4, height: 12), cornerRadius: 1)
                stake.fillColor = Self.color(0xE69A54)
                stake.strokeColor = .clear
                stake.position = CGPoint(x: point.x, y: point.y + 5)
                node.addChild(stake)
            }
            let plus = SKLabelNode(fontNamed: "AvenirNext-Medium")
            plus.text = "+"
            plus.isAccessibilityElement = false
            plus.fontSize = 30
            plus.fontColor = Self.color(0xB97638)
            plus.verticalAlignmentMode = .center
            plus.position.y = 2
            node.addChild(plus)
            return node
        }

        let shadow = SKShapeNode(ellipseOf: CGSize(width: 150, height: 43))
        shadow.fillColor = UIColor.black.withAlphaComponent(0.13)
        shadow.strokeColor = .clear
        shadow.position = CGPoint(x: 5, y: 8)
        node.addChild(shadow)
        if let texture = texture(for: lot.id) {
            if stage > 1 {
                for index in 0..<(stage - 1) {
                    let annex = SKSpriteNode(texture: texture)
                    annex.size = CGSize(width: 74, height: 74)
                    annex.anchorPoint = CGPoint(x: 0.5, y: 0.12)
                    annex.position = CGPoint(x: index == 0 ? -72 : 73, y: 4)
                    annex.zPosition = 1
                    node.addChild(annex)
                }
            }
            let art = SKSpriteNode(texture: texture)
            let side: CGFloat = 180 + CGFloat(stage - 1) * 18
            art.size = CGSize(width: side, height: side)
            art.anchorPoint = CGPoint(x: 0.5, y: 0.12)
            art.position.y = 7
            art.zPosition = 2
            node.addChild(art)
        } else {
            // A missing bundled illustration leaves an honest named parcel,
            // never a different building or fabricated factory silhouette.
            let missing = SKLabelNode(fontNamed: "AvenirNext-Medium")
            missing.text = lot.id
            missing.isAccessibilityElement = false
            missing.fontSize = 12
            missing.fontColor = Self.color(0x334F58)
            missing.position.y = 24
            node.addChild(missing)
        }
        let quantity = SKLabelNode(fontNamed: quantityFont.fontName)
        quantity.name = "quantity"
        quantity.text = "×\(lot.quantity)"
        quantity.isAccessibilityElement = false
        quantity.fontSize = quantityFont.pointSize
        quantity.fontColor = Self.color(0x4C6768)
        quantity.verticalAlignmentMode = .center
        quantity.position = CGPoint(x: 0, y: -33)
        quantity.zPosition = 3
        quantity.setScale(viewpoint.xScale)
        node.addChild(quantity)
        return node
    }

    private func updateSelection() {
        for (id, node) in drawings {
            node.childNode(withName: "selection")?.alpha = id == selectedID ? 1 : 0
        }
    }

    private func updateQuantityScale() {
        for node in drawings.values { node.childNode(withName: "quantity")?.setScale(viewpoint.xScale) }
        lastQuantityScale = viewpoint.xScale
    }

    fileprivate func updateQuantityTypography(compatibleWith traits: UITraitCollection) {
        let font = UIFontMetrics(forTextStyle: .caption1).scaledFont(
            for: UIFont.systemFont(ofSize: 14, weight: .semibold), compatibleWith: traits)
        guard font.fontName != quantityFont.fontName || font.pointSize != quantityFont.pointSize else { return }
        quantityFont = font
        for node in drawings.values {
            guard let label = node.childNode(withName: "quantity") as? SKLabelNode else { continue }
            label.fontName = font.fontName
            label.fontSize = font.pointSize
        }
    }

    private func texture(for id: String) -> SKTexture? {
        if let existing = textures[id] { return existing }
        let filename = "building-\(id)-v4"
        let url = Bundle.main.url(forResource: filename, withExtension: "png", subdirectory: "NativeAssets")
        let image = url.flatMap { UIImage(contentsOfFile: $0.path) } ?? UIImage(named: filename)
        guard let image else { return nil }
        let texture = SKTexture(image: image)
        texture.filteringMode = .linear
        texture.usesMipmaps = true
        textures[id] = texture
        return texture
    }

    private func refreshLife() {
        let occupied = lots.filter { $0.quantity > 0 }
        let signature = "\(reducedMotion):" + occupied.map { "\($0.id):\($0.quantity >= 25 ? 3 : $0.quantity >= 10 ? 2 : 1)" }.joined(separator: ",")
        guard signature != lifeSignature else { return }
        lifeSignature = signature
        life.removeAllChildren()
        life.zPosition = -900 // Surface life stays below the owned illustrations.
        guard !occupied.isEmpty else { return }

        // Signals remain useful when motion is reduced. At most three vehicles
        // and three paper emitters are active, regardless of save size.
        for (index, lot) in occupied.enumerated() {
            guard let point = lotPosition(lot.id) else { continue }
            let signal = SKShapeNode(circleOfRadius: 3)
            signal.fillColor = Self.color(0x9CBD86)
            signal.strokeColor = Self.color(0xF5F3CE)
            signal.lineWidth = 1
            signal.position = CGPoint(x: point.x + 98, y: point.y + 1)
            signal.zPosition = 3000
            life.addChild(signal)
            if !reducedMotion {
                let pulse = SKAction.sequence([.fadeAlpha(to: 0.48, duration: 1.5), .fadeAlpha(to: 1, duration: 1.5)])
                signal.run(.sequence([.wait(forDuration: Double(index % 4) * 0.35), .repeatForever(pulse)]))
            }
        }
        let conveyorIDs: Set<String> = ["digitalPress", "offsetPress", "finishingWorkshop", "insertingLine"]
        for lot in occupied.filter({ conveyorIDs.contains($0.id) }).prefix(3) {
            guard let point = lotPosition(lot.id) else { continue }
            let conveyor = conveyorNode()
            conveyor.position = CGPoint(x: point.x + 92, y: point.y - 18)
            conveyor.zRotation = -0.22
            conveyor.zPosition = 3000
            life.addChild(conveyor)
        }
        guard !reducedMotion else { return }
        let vehicleCount = min(3, 1 + occupied.count / 4)
        let rows = Int(ceil(Double(Self.ids.count) / Double(layoutColumns)))
        for index in 0..<vehicleCount {
            let origin = occupied[(index * 3) % occupied.count]
            guard let sourceIndex = Self.ids.firstIndex(of: origin.id) else { continue }
            let row = min(sourceIndex / layoutColumns, max(0, rows - 2))
            let roadY = (CGFloat(rows - 1) / 2 - CGFloat(row) - 0.5) * 214 - 24
            let vehicle = vehicleNode()
            let start = CGPoint(x: terrainBounds.minX + 68, y: roadY - 13)
            let end = CGPoint(x: terrainBounds.maxX - 111, y: roadY + 10)
            vehicle.position = start
            vehicle.alpha = 0
            vehicle.zRotation = 0.035
            life.addChild(vehicle)
            let travel = SKAction.move(to: end, duration: 14 + Double(index) * 2)
            travel.timingMode = .linear
            vehicle.run(.repeatForever(.sequence([
                .wait(forDuration: Double(index) * 3), .fadeIn(withDuration: 0.7), travel,
                .fadeOut(withDuration: 0.7), .move(to: start, duration: 0), .wait(forDuration: 4)
            ])))
        }
        for lot in occupied.suffix(3) {
            guard let point = lotPosition(lot.id) else { continue }
            let paper = SKEmitterNode()
            paper.particleTexture = paperTexture
            paper.particleBirthRate = 0.35
            paper.numParticlesToEmit = 0
            paper.particleLifetime = 2.4
            paper.particleLifetimeRange = 0.4
            paper.particleSpeed = 12
            paper.particleSpeedRange = 4
            paper.emissionAngle = .pi * 0.65
            paper.emissionAngleRange = .pi * 0.2
            paper.particleScale = 0.8
            paper.particleScaleRange = 0.2
            paper.particleAlpha = 0.52
            paper.particleAlphaSpeed = -0.22
            paper.particleRotationRange = .pi * 0.3
            paper.position = CGPoint(x: point.x + 75, y: point.y + 5)
            paper.zPosition = 3000
            paper.particlePositionRange = CGVector(dx: 12, dy: 4)
            life.addChild(paper)
        }
    }

    private lazy var paperTexture: SKTexture = {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: CGSize(width: 10, height: 6), format: format).image { context in
            Self.color(0xFFF7DC).setFill()
            context.fill(CGRect(x: 0, y: 0, width: 10, height: 6))
        }
        return SKTexture(image: image)
    }()

    private func vehicleNode() -> SKNode {
        let vehicle = SKNode()
        let shadow = SKShapeNode(ellipseOf: CGSize(width: 25, height: 9))
        shadow.fillColor = UIColor.black.withAlphaComponent(0.12)
        shadow.strokeColor = .clear
        shadow.position.y = -3
        vehicle.addChild(shadow)
        let cargo = SKShapeNode(rectOf: CGSize(width: 17, height: 10), cornerRadius: 2)
        cargo.fillColor = Self.color(0xFCF1CF)
        cargo.strokeColor = Self.color(0xC8B993)
        cargo.lineWidth = 0.7
        vehicle.addChild(cargo)
        let cab = SKShapeNode(rectOf: CGSize(width: 8, height: 9), cornerRadius: 2)
        cab.fillColor = Self.color(0x355B67)
        cab.strokeColor = .clear
        cab.position.x = 11
        vehicle.addChild(cab)
        return vehicle
    }

    private func conveyorNode() -> SKNode {
        let conveyor = SKNode()
        let belt = SKShapeNode(rectOf: CGSize(width: 38, height: 9), cornerRadius: 2)
        belt.fillColor = Self.color(0x778B86)
        belt.strokeColor = Self.color(0xD4D8B8)
        belt.lineWidth = 1
        conveyor.addChild(belt)
        for index in 0..<4 {
            let roller = SKShapeNode(rectOf: CGSize(width: 1, height: 7))
            roller.fillColor = Self.color(0xB4C1AB)
            roller.strokeColor = .clear
            roller.position.x = CGFloat(index) * 9 - 13
            conveyor.addChild(roller)
        }
        for index in 0..<2 {
            let sheet = SKSpriteNode(texture: paperTexture)
            sheet.size = CGSize(width: 8, height: 5)
            sheet.position.x = CGFloat(index) * 16 - 8
            conveyor.addChild(sheet)
            if !reducedMotion {
                sheet.alpha = 0
                sheet.run(.repeatForever(.sequence([
                    .wait(forDuration: Double(index) * 1.4), .moveTo(x: -15, duration: 0),
                    .fadeIn(withDuration: 0.2), .moveTo(x: 15, duration: 2.8),
                    .fadeOut(withDuration: 0.2), .wait(forDuration: 1.5)
                ])))
            }
        }
        return conveyor
    }

    private func treeNode(variant: Int) -> SKNode {
        let tree = SKNode()
        let shadow = SKShapeNode(ellipseOf: CGSize(width: 29, height: 12))
        shadow.fillColor = UIColor.black.withAlphaComponent(0.09)
        shadow.strokeColor = .clear
        shadow.position.x = 5
        tree.addChild(shadow)
        let trunk = SKShapeNode(rectOf: CGSize(width: 4, height: 15), cornerRadius: 1)
        trunk.fillColor = Self.color(0x8F8A64)
        trunk.strokeColor = .clear
        trunk.position.y = 8
        tree.addChild(trunk)
        let colors: [UInt32] = [0x82977B, 0xA4AC84, 0x6D8978]
        let crown = SKShapeNode(ellipseOf: CGSize(width: 23 + CGFloat(variant) * 3, height: 27))
        crown.fillColor = Self.color(colors[variant])
        crown.strokeColor = Self.color(0xC3CAA4).withAlphaComponent(0.65)
        crown.lineWidth = 1
        crown.position.y = 24
        tree.addChild(crown)
        return tree
    }

    private func frameVisibleLots(animated: Bool) {
        guard size.width > 0, size.height > 0 else { return }
        let visible = lots.filter { $0.quantity > 0 || $0.unlocked }
        let ids = visible.isEmpty ? [Self.ids[0]] : visible.map(\.id)
        var bounds = CGRect.null
        for id in ids {
            guard let point = lotPosition(id) else { continue }
            bounds = bounds.union(CGRect(x: point.x - 124, y: point.y - 58, width: 248, height: 263))
        }
        guard !bounds.isNull else { return }
        bounds = bounds.insetBy(dx: -18, dy: -18)
        let available = availableViewport
        let scale = max(0.78, min(3.3, max(bounds.width / available.width, bounds.height / available.height)))
        moveCamera(to: cameraCentre(for: CGPoint(x: bounds.midX, y: bounds.midY), scale: scale), scale: scale, animated: animated)
    }

    private var availableViewport: CGRect {
        CGRect(x: contentInsets.left, y: contentInsets.top,
               width: max(140, size.width - contentInsets.left - contentInsets.right),
               height: max(160, size.height - contentInsets.top - contentInsets.bottom))
    }

    private func cameraCentre(for point: CGPoint, scale: CGFloat) -> CGPoint {
        let available = availableViewport
        return CGPoint(x: point.x - (available.midX - size.width / 2) * scale,
                       y: point.y + (available.midY - size.height / 2) * scale)
    }

    private func moveCamera(to point: CGPoint, scale: CGFloat, animated: Bool) {
        viewpoint.removeAllActions()
        if animated && !reducedMotion && view != nil {
            let move = SKAction.move(to: point, duration: 0.48)
            let zoom = SKAction.scale(to: scale, duration: 0.48)
            move.timingMode = .easeInEaseOut
            zoom.timingMode = .easeInEaseOut
            viewpoint.run(.group([move, zoom]))
        } else {
            viewpoint.position = point
            viewpoint.setScale(scale)
        }
        updateQuantityScale()
        onViewportChange?()
    }

    private func constrainCamera() {
        let margin: CGFloat = 150
        viewpoint.position.x = min(terrainBounds.maxX + margin, max(terrainBounds.minX - margin, viewpoint.position.x))
        viewpoint.position.y = min(terrainBounds.maxY + margin, max(terrainBounds.minY - margin, viewpoint.position.y))
    }

    private func diamond(width: CGFloat, height: CGFloat) -> CGPath {
        let path = CGMutablePath()
        path.move(to: CGPoint(x: 0, y: height / 2))
        path.addLine(to: CGPoint(x: width / 2, y: 0))
        path.addLine(to: CGPoint(x: 0, y: -height / 2))
        path.addLine(to: CGPoint(x: -width / 2, y: 0))
        path.closeSubpath()
        return path
    }

    private func shape(_ path: CGPath, fill: UInt32, stroke: UInt32? = nil, width: CGFloat = 0) -> SKShapeNode {
        let node = SKShapeNode(path: path)
        node.fillColor = Self.color(fill)
        node.strokeColor = stroke.map(Self.color) ?? .clear
        node.lineWidth = width
        node.isAntialiased = true
        return node
    }

    private func line(_ path: CGPath, color: UInt32, width: CGFloat) -> SKShapeNode {
        let node = SKShapeNode(path: path)
        node.strokeColor = Self.color(color)
        node.fillColor = .clear
        node.lineWidth = width
        node.lineCap = .round
        node.lineJoin = .round
        node.isAntialiased = true
        return node
    }

    private static func color(_ value: UInt32) -> UIColor {
        UIColor(red: CGFloat((value >> 16) & 255) / 255,
                green: CGFloat((value >> 8) & 255) / 255,
                blue: CGFloat(value & 255) / 255, alpha: 1)
    }
}

/// Follow the presented view's actual traits, including changes while the scene is paused.
@MainActor
private final class EmpireSKView: SKView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        registerForTraitChanges([UITraitPreferredContentSizeCategory.self]) { (view: EmpireSKView, _: UITraitCollection) in
            (view.scene as? EmpireScene)?.updateQuantityTypography(compatibleWith: view.traitCollection)
        }
    }

    required init?(coder: NSCoder) { nil }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        (scene as? EmpireScene)?.updateQuantityTypography(compatibleWith: traitCollection)
    }
}

/// Native SpriteKit presentation. The caller owns the scene and game model.
@MainActor
struct NativeEmpireSceneView: UIViewRepresentable {
    let scene: EmpireScene
    let lots: [EmpireLot]
    let reducedMotion: Bool
    var isActive = true
    var contentInsets = UIEdgeInsets(top: 140, left: 16, bottom: 120, right: 16)
    var accessibilityNames: [String: String] = [:]
    var onSelectLot: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(scene: scene) }

    func makeUIView(context: Context) -> SKView {
        let view = EmpireSKView(frame: .zero)
        view.ignoresSiblingOrder = true
        view.shouldCullNonVisibleNodes = true
        view.preferredFramesPerSecond = reducedMotion ? 30 : 60
        view.isMultipleTouchEnabled = true
        view.allowsTransparency = false
        view.isAccessibilityElement = false
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tap(_:)))
        let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.pan(_:)))
        pan.maximumNumberOfTouches = 1
        let pinch = UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.pinch(_:)))
        pan.delegate = context.coordinator
        pinch.delegate = context.coordinator
        tap.require(toFail: pan)
        tap.require(toFail: pinch)
        view.addGestureRecognizer(tap)
        view.addGestureRecognizer(pan)
        view.addGestureRecognizer(pinch)
        context.coordinator.view = view
        view.presentScene(scene)
        configure(view, coordinator: context.coordinator)
        return view
    }

    func updateUIView(_ uiView: SKView, context: Context) {
        if uiView.scene !== scene { uiView.presentScene(scene) }
        configure(uiView, coordinator: context.coordinator)
    }

    private func configure(_ view: SKView, coordinator: Coordinator) {
        coordinator.scene = scene
        coordinator.names = accessibilityNames
        scene.onSelectLot = onSelectLot
        scene.onViewportChange = { [weak coordinator] in coordinator?.refreshAccessibility() }
        scene.setContentInsets(contentInsets)
        scene.setReducedMotion(reducedMotion)
        scene.updateQuantityTypography(compatibleWith: view.traitCollection)
        scene.updateLots(lots)
        scene.isPaused = !isActive
        view.isPaused = !isActive
        view.preferredFramesPerSecond = reducedMotion ? 30 : 60
        coordinator.refreshAccessibility()
    }

    static func dismantleUIView(_ view: SKView, coordinator: Coordinator) {
        coordinator.scene.onViewportChange = nil
        view.isPaused = true
        view.presentScene(nil)
    }

    @MainActor
    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var scene: EmpireScene
        weak var view: SKView?
        var names: [String: String] = [:]

        init(scene: EmpireScene) { self.scene = scene }

        @objc func tap(_ gesture: UITapGestureRecognizer) {
            guard gesture.state == .ended, let view else { return }
            scene.select(at: gesture.location(in: view))
        }

        @objc func pan(_ gesture: UIPanGestureRecognizer) {
            guard let view else { return }
            if gesture.state == .began { scene.beginCameraGesture() }
            if gesture.state == .changed {
                scene.pan(by: gesture.translation(in: view))
                gesture.setTranslation(.zero, in: view)
            }
        }

        @objc func pinch(_ gesture: UIPinchGestureRecognizer) {
            guard let view else { return }
            if gesture.state == .began { scene.beginCameraGesture() }
            if gesture.state == .changed {
                scene.zoom(by: gesture.scale, at: gesture.location(in: view))
                gesture.scale = 1
            }
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            gestureRecognizer is UIPinchGestureRecognizer || otherGestureRecognizer is UIPinchGestureRecognizer
        }

        func refreshAccessibility() {
            scene.updateAccessibility(names: names)
        }
    }
}

@MainActor
private final class EmpireLotNode: SKNode, UIAccessibilityIdentification {
    var accessibilityIdentifier: String?
    var activate: (() -> Bool)?
    var frameProvider: (() -> CGRect)?

    // UIAccessibility uses screen coordinates on iOS. Resolve on demand so
    // VoiceOver follows camera easing, panning and view/window placement.
    override var accessibilityFrame: CGRect {
        get { frameProvider?() ?? .zero }
        set { super.accessibilityFrame = newValue }
    }

    override func accessibilityActivate() -> Bool {
        activate?() ?? false
    }
}
