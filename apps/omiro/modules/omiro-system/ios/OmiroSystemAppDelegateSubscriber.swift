import CoreSpotlight
import ExpoModulesCore
import UIKit

// Routes Home Screen quick actions and tapped Spotlight results into the app.
// Expo's scene delegate forwards both here, on a cold start too.
public class OmiroSystemAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    guard let path = OmiroSystemPath.quickActions[shortcutItem.type] else {
      completionHandler(false)
      return
    }
    OmiroSystemLinkStore.shared.receive(path)
    completionHandler(true)
  }

  public func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([any UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    guard
      userActivity.activityType == CSSearchableItemActionType,
      let identifier = userActivity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
      let path = OmiroSystemPath.path(forSpotlightIdentifier: identifier)
    else {
      return false
    }
    OmiroSystemLinkStore.shared.receive(path)
    return true
  }
}
