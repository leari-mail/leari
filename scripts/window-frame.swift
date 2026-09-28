// Turns a rectangular window capture into a macOS-style window image: rounded corners
// (transparent outside), padding and a soft drop shadow. Used by scripts/screenshots.sh.
//
//   swift scripts/window-frame.swift <in.png> <out.png> [corner radius in px]
import AppKit

let args = CommandLine.arguments
guard args.count >= 3,
  let source = NSImage(contentsOfFile: args[1]),
  let image = source.cgImage(forProposedRect: nil, context: nil, hints: nil)
else {
  FileHandle.standardError.write("usage: window-frame <in.png> <out.png> [radius]\n".data(using: .utf8)!)
  exit(1)
}
let radius = CGFloat(Double(args.count > 3 ? args[3] : "") ?? 26)
let width = CGFloat(image.width), height = CGFloat(image.height)
let padding = (width * 0.04).rounded()

guard let context = CGContext(
  data: nil, width: Int(width + padding * 2), height: Int(height + padding * 2),
  bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
else { exit(1) }

let frame = CGRect(x: padding, y: padding, width: width, height: height)
let window = CGPath(roundedRect: frame, cornerWidth: radius, cornerHeight: radius, transform: nil)

// Shadow, drawn by filling the window shape once.
context.saveGState()
context.setShadow(offset: CGSize(width: 0, height: -padding * 0.25), blur: padding * 0.6,
                  color: CGColor(gray: 0, alpha: 0.35))
context.addPath(window)
context.setFillColor(CGColor(gray: 0, alpha: 1))
context.fillPath()
context.restoreGState()

// The capture, clipped to the rounded window.
context.addPath(window)
context.clip()
context.draw(image, in: frame)

guard let output = context.makeImage(),
  let png = NSBitmapImageRep(cgImage: output).representation(using: .png, properties: [:])
else { exit(1) }
try png.write(to: URL(fileURLWithPath: args[2]))
