import Foundation
import Vision
import AppKit
let folder = CommandLine.arguments[1]
let files = try FileManager.default.contentsOfDirectory(atPath: folder).filter { $0.hasSuffix(".png") }.sorted()
var output: [[String: Any]] = []
for file in files {
 autoreleasepool {
  let url = URL(fileURLWithPath: folder).appendingPathComponent(file)
  let request = VNDetectFaceLandmarksRequest()
  do {
   try VNImageRequestHandler(url:url,options:[:]).perform([request])
   if let face = request.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }) {
    let box=face.boundingBox
    func center(_ points: VNFaceLandmarkRegion2D?) -> CGPoint? {
     guard let points=points,points.pointCount>0 else{return nil}
     let p=points.normalizedPoints
     let x=p.reduce(CGFloat(0)){$0+$1.x}/CGFloat(points.pointCount)
     let y=p.reduce(CGFloat(0)){$0+$1.y}/CGFloat(points.pointCount)
     return CGPoint(x:box.origin.x+CGFloat(x)*box.width,y:1-(box.origin.y+CGFloat(y)*box.height))
    }
    if let left=center(face.landmarks?.leftEye),let right=center(face.landmarks?.rightEye){
     output.append(["file":file,"x":(left.x+right.x)/2,"y":(left.y+right.y)/2,"eyeDistance":hypot(left.x-right.x,left.y-right.y)])
    }
   }
  }catch{}
 }
}
let data=try JSONSerialization.data(withJSONObject:output)
FileHandle.standardOutput.write(data)
