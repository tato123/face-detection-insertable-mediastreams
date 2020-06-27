const window = self;

const HTMLCanvasElement = OffscreenCanvas;
const CanvasRenderingContext2D = OffscreenCanvasRenderingContext2D;

class Image {}
class HTMLImageElement {}
class HTMLVideoElement {}

self.importScripts("face-api.js");

faceapi.env.getEnv().createCanvasElement = function () {
  return new OffscreenCanvas(640, 480);
};

const options = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.5,
});

let loaded = false;
let overlay;
let worker;
let canvas = new OffscreenCanvas(640, 480);

const loader = faceapi.nets.tinyFaceDetector.load("./").then(async () => {
  //Dry run
  const result = await faceapi.detectSingleFace(canvas, options);
  //Done
  loaded = true;
  //Log
  console.log("face api enabled");
});

self.onmessage = async (event) => {
  switch (event.data.cmd) {
    case "worker":
      worker = event.data.port;
      break;
    case "canvas":
      overlay = event.data.canvas;
      break;
    case "frame": {
      if (!loaded) return;
      try {
        //get image size
        const displaySize = {
          width: event.data.width,
          height: event.data.height,
        };
        //Change canvas size
        faceapi.matchDimensions(canvas, displaySize);
        //Paint in canvas
        canvas.width = event.data.width;
        canvas.height = event.data.height;
        canvas
          .getContext("bitmaprenderer")
          .transferFromImageBitmap(event.data.frame);
        //Deted face
        const result = await faceapi.detectSingleFace(canvas, options);
        //If we got a new face
        if (result) {
          //Send it in next frame
          worker.postMessage({
            cmd: "face",
            size: Math.max(result.box.width, result.box.height),
            x: result.box.x + result.box.width / 2,
            y: result.box.y + result.box.height / 2,
          });
          faceapi.matchDimensions(overlay, displaySize);
          faceapi.draw.drawDetections(
            overlay,
            faceapi.resizeResults(result, displaySize)
          );
        }
      } catch (e) {
        console.error();
      }
    }
  }
};
