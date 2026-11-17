import CoreSpotlight
import ExpoModulesCore
import UIKit
import UniformTypeIdentifiers
import Vision

struct SpotlightItemRecord: Record {
  @Field var id: String = ""
  // "chat" or "note".
  @Field var kind: String = ""
  @Field var title: String = ""
  @Field var body: String?
  @Field var updatedAt: String?
}

final class OmiroSystemException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    param
  }
}

private let spotlightDomain = "omiro.content"
private let linkEvent = "onLink"

public class OmiroSystemModule: Module {
  private var linkObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("OmiroSystem")

    Events(linkEvent)

    OnStartObserving {
      self.linkObserver = NotificationCenter.default.addObserver(
        forName: .omiroSystemLink,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let path = notification.userInfo?["path"] as? String else {
          return
        }
        // The listener has it now; nothing is left pending for a later launch.
        _ = OmiroSystemLinkStore.shared.consume()
        self?.sendEvent(linkEvent, ["path": path])
      }
    }

    OnStopObserving {
      if let linkObserver = self.linkObserver {
        NotificationCenter.default.removeObserver(linkObserver)
        self.linkObserver = nil
      }
    }

    // The link that opened the app before JavaScript was listening, once.
    Function("consumePendingLink") { () -> String? in
      OmiroSystemLinkStore.shared.consume()
    }

    AsyncFunction("indexSpotlightItems") { (items: [SpotlightItemRecord]) in
      let dateParser = ISO8601DateFormatter()
      dateParser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      let searchableItems = items.map { item in
        let attributes = CSSearchableItemAttributeSet(contentType: .text)
        attributes.title = item.title
        attributes.contentDescription = item.body
        if let updatedAt = item.updatedAt {
          attributes.contentModificationDate = dateParser.date(from: updatedAt)
        }
        return CSSearchableItem(
          uniqueIdentifier: OmiroSystemPath.spotlightIdentifier(kind: item.kind, id: item.id),
          domainIdentifier: spotlightDomain,
          attributeSet: attributes
        )
      }
      try await CSSearchableIndex.default().indexSearchableItems(searchableItems)
    }

    AsyncFunction("removeSpotlightItems") { (identifiers: [String]) in
      try await CSSearchableIndex.default().deleteSearchableItems(withIdentifiers: identifiers)
    }

    AsyncFunction("clearSpotlight") {
      try await CSSearchableIndex.default().deleteSearchableItems(
        withDomainIdentifiers: [spotlightDomain]
      )
    }

    // Reads the text in an image file, top to bottom. Runs on-device.
    AsyncFunction("recognizeText") { (uri: String) -> String in
      guard
        let url = URL(string: uri),
        let image = UIImage(contentsOfFile: url.path),
        let cgImage = image.cgImage
      else {
        throw OmiroSystemException("The image could not be read.")
      }
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = true
      let handler = VNImageRequestHandler(
        cgImage: cgImage,
        orientation: CGImagePropertyOrientation(image.imageOrientation)
      )
      try handler.perform([request])
      return (request.results ?? [])
        .compactMap { $0.topCandidates(1).first?.string }
        .joined(separator: "\n")
    }

    // Lays an HTML document out on US Letter pages and writes it to a PDF in
    // the caches directory. Returns the file URL.
    AsyncFunction("renderPdf") { (fileName: String, html: String) -> String in
      let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)
      let margin: CGFloat = 54
      let renderer = UIPrintPageRenderer()
      renderer.addPrintFormatter(UIMarkupTextPrintFormatter(markupText: html), startingAtPageAt: 0)
      renderer.setValue(pageRect, forKey: "paperRect")
      renderer.setValue(pageRect.insetBy(dx: margin, dy: margin), forKey: "printableRect")

      let data = NSMutableData()
      UIGraphicsBeginPDFContextToData(data, pageRect, nil)
      for page in 0..<renderer.numberOfPages {
        UIGraphicsBeginPDFPage()
        renderer.drawPage(at: page, in: UIGraphicsGetPDFContextBounds())
      }
      UIGraphicsEndPDFContext()

      let directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("exports", isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let fileURL = directory.appendingPathComponent(fileName).appendingPathExtension("pdf")
      try data.write(to: fileURL, options: .atomic)
      return fileURL.absoluteString
    }
    .runOnQueue(.main)
  }
}

private extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up: self = .up
    case .down: self = .down
    case .left: self = .left
    case .right: self = .right
    case .upMirrored: self = .upMirrored
    case .downMirrored: self = .downMirrored
    case .leftMirrored: self = .leftMirrored
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
