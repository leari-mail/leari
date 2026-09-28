// Prints "<window id> <x>,<y>,<width>,<height>" for the visible main window of a process, for
// scripts/screenshots.sh. Usage: swift scripts/window-id.swift <pid>
import CoreGraphics

let pid = Int32(CommandLine.arguments[1]) ?? -1
let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []
for window in windows {
  guard (window[kCGWindowOwnerPID as String] as? Int32) == pid,
    (window[kCGWindowLayer as String] as? Int) == 0,
    let bounds = window[kCGWindowBounds as String] as? [String: CGFloat],
    let x = bounds["X"], let y = bounds["Y"], let width = bounds["Width"], let height = bounds["Height"],
    width > 600
  else { continue }
  print("\(window[kCGWindowNumber as String] ?? "") \(Int(x)),\(Int(y)),\(Int(width)),\(Int(height))")
  break
}
