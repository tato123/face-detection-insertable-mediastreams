let face;

async function insert(chunk, controller) {
  try {
    let metadata;
    //Check if we had a previously unsent face info
    if (!face) {
      //No face
      metadata = new ArrayBuffer(1);
      //Create view
      const view = new DataView(metadata);
      //zero size
      view.setUint8(0, 0);
    } else {
      //Face info
      metadata = new ArrayBuffer(5);
      //Create view
      const view = new DataView(metadata);
      //Set face center
      view.setUint16(0, face.x);
      view.setUint16(2, face.y);
      //Set face size
      view.setUint8(4, face.size / 16 + 1);
      //Remove face
      face = null;
    }
    //Get frame data
    const frame = chunk.data;
    //Extend chunk
    chunk.data = new ArrayBuffer(metadata.byteLength + chunk.data.byteLength);
    //Get view
    const data = new Uint8Array(chunk.data);
    //Copy frame
    data.set(new Uint8Array(frame), 0);
    //Copy metadata
    data.set(new Uint8Array(metadata), frame.byteLength);
    //Write
    controller.enqueue(chunk);
  } catch (e) {
    console.error(e);
  }
}

async function extract(chunk, controller) {
  try {
    let size, x, y;
    //Create view
    const view = new DataView(chunk.data);
    //Get face size
    const last = view.getUint8(chunk.data.byteLength - 1);
    //If found
    if (last) {
      //Update size
      const size = (last - 1) * 16;
      //Get face center
      const x = view.getUint16(chunk.data.byteLength - 5);
      const y = view.getUint16(chunk.data.byteLength - 3);
      //Send back message
      postMessage({ x, y, size });
    }
    //Remove metadata
    chunk.data = chunk.data.slice(0, chunk.data.byteLength - (last ? 5 : 1));
    //Transfer the frame to controller
    controller.enqueue(chunk);
  } catch (e) {
    console.error(e);
  }
}
let detector;
onmessage = async (event) => {
  //Depending on the mode
  switch (event.data.cmd) {
    case "detector": {
      //get detector
      detector = event.data.port;
      //Listen
      detector.onmessage = (event) => {
        //get face data
        face = event.data;
      };
      //Done
      break;
    }
    case "insert": {
      //Get streams
      const { readableStream, writableStream } = event.data;
      //New transform stream for inserting metadata
      const transformStream = new TransformStream({ transform: insert });
      //Pipe
      readableStream.pipeThrough(transformStream).pipeTo(writableStream);
      //Done
      break;
    }
    case "extract": {
      //Get streams
      const { readableStream, writableStream } = event.data;
      //New transform stream for inserting metadata
      const transformStream = new TransformStream({ transform: extract });
      //Pipe
      readableStream.pipeThrough(transformStream).pipeTo(writableStream);
      //Done
      break;
    }
  }
};
