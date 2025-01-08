//
//  File.swift
//  App
//
//  Created by 秋星桥 on 2025/1/8.
//

import UIKit
import Intelligents

extension AFFiNEViewController: IntelligentsButtonDelegate, IntelligentsFocusApertureViewDelegate {
  func onIntelligentsButtonTapped(_ button: IntelligentsButton) {
    guard let webView else {
      assertionFailure() // ? wdym ?
      return
    }

    button.beginProgress()

    let group = DispatchGroup()
    
    group.enter()
    webView.evaluateScript(.getCurrentServerBaseUrl) { result in
      self.baseUrl = result as? String
      print("[*] setting baseUrl: \(self.baseUrl ?? "")")
      group.leave()
    }
    
    group.enter()
    webView.evaluateScript(.getCurrentDocId) { result in
      self.documentID = result as? String
      print("[*] setting documentID: \(self.documentID ?? "")")
      group.leave()
    }
    
    group.enter()
    webView.evaluateScript(.getCurrentWorkspaceId) { result in
      self.workspaceID = result as? String
      print("[*] setting workspaceID: \(self.workspaceID ?? "")")
      group.leave()
    }
    
    group.enter()
    webView.evaluateScript(.getCurrentDocContentInMarkdown) { input in
      self.documentContent = input as? String
      print("[*] setting documentContent: \(self.documentContent?.count ?? 0) chars")
      group.leave()
    }
    
    DispatchQueue.global().async {
      group.wait()
      DispatchQueue.main.async {
        button.stopProgress()
        webView.resignFirstResponder()
        self.openIntelligentsSheet()
      }
    }
  }

  @discardableResult
  func openIntelligentsSheet() -> IntelligentsFocusApertureView? {
    view.resignFirstResponder()
    guard let view = webView?.subviews.first else {
      assertionFailure()
      return nil
    }
    assert(view is UIScrollView)
    let focus = IntelligentsFocusApertureView()
    focus.prepareAnimationWith(
      capturingTargetContentView: view,
      coveringRootViewController: self
    )
    focus.delegate = self
    focus.executeAnimationKickIn()
    dismissIntelligentsButton()
    return focus
  }

  func openSimpleChat() {
    let targetController = IntelligentsChatController()
    presentIntoCurrentContext(withTargetController: targetController)
  }

  func focusApertureRequestAction(
    from view: IntelligentsFocusApertureView,
    actionType: IntelligentsFocusApertureViewActionType
  ) {
    switch actionType {
    case .translateTo:
      // TODO: IMPL
      let controller = IntelligentsEphemeralActionController(action: .translate(
        to: .langSimplifiedChinese,
        workspaceID: workspaceID ?? "",
        documentID: documentID ?? ""
      ))
      controller.configure(previewImage: view.capturedImage ?? .init())
      presentIntoCurrentContext(withTargetController: controller)
    case .summary:
        let controller = IntelligentsEphemeralActionController(action: .summarize(
          workspaceID: workspaceID ?? "",
          documentID: documentID ?? ""
        ))
        controller.configure(previewImage: view.capturedImage ?? .init())
        presentIntoCurrentContext(withTargetController: controller)
    case .chatWithAI:
      let controller = IntelligentsChatController()
      controller.metadata[.documentID] = documentID
      controller.metadata[.workspaceID] = workspaceID
      controller.metadata[.content] = documentContent
      presentIntoCurrentContext(withTargetController: controller)
    case .dismiss:
      presentIntelligentsButton()
    }
  }
}
