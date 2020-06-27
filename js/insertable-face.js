const url = "wss://sgmedooze.cosmosoftware.io/";

function addVideoForStream(stream, muted) {
  //Create new video element
  const video = document.querySelector(muted ? "#local" : "#remote");
  //Set src stream
  video.srcObject = stream;
  //Set other properties
  video.autoplay = true;
  video.muted = muted;
}
function removeVideoForStream(stream) {
  //Get video
  var video = document.getElementById(stream.id);
  //Remove it when done
  video.addEventListener("webkitTransitionEnd", function () {
    //Delete it
    video.parentElement.removeChild(video);
  });
  //Disable it first
  video.className = "disabled";
}

var sdp;
var pc;
var localStream;

//Face detector
var detector = new Worker("js/detector.js");
//Metadata insert/extract worker
var worker = new Worker("js/worker.js");

//Focus face when metadata is received
worker.addEventListener("message", async (event) => {
  console.log("Got remote face", event.data);
  //Show a bit more than the face
  const faceSize = Math.min(
    event.data.size * 2,
    inner.offsetWidth,
    inner.offsetHeight
  );
  const outherSize = outher.offsetWidth;
  //Calculate zoom
  const zoom = outherSize / faceSize;
  //Move inner to show face
  var left = outher.offsetWidth / 2 - event.data.x * zoom;
  var top = outher.offsetHeight / 2 - event.data.y * zoom;
  //Don't go out of video image
  left = Math.max(outher.offsetWidth - inner.offsetWidth * zoom, left);
  left = Math.min(0, left);
  top = Math.max(outher.offsetHeight - inner.offsetHeight * zoom, top);
  top = Math.min(0, top);
  //Set style to move video
  Object.assign(inner.style, {
    transform: "scale(" + zoom + ")",
    left: left + "px",
    top: top + "px",
  });
});

//Get offscreen canvas
const offscreen = overlay.transferControlToOffscreen();
//Send canvas to detector
detector.postMessage(
  {
    cmd: "canvas",
    canvas: offscreen,
  },
  [offscreen]
);

const channel = new MessageChannel();
detector.postMessage(
  {
    cmd: "worker",
    port: channel.port1,
  },
  [channel.port1]
);
worker.postMessage(
  {
    cmd: "detector",
    port: channel.port2,
  },
  [channel.port2]
);

async function connect() {
  //Get local stream
  const localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });

  //Play it
  local.srcObject = localStream;
  local.play();

  //Get images from
  const grab = async () => {
    try {
      //Get frame from video
      const frame = await createImageBitmap(local);
      //Send to detector
      detector.postMessage(
        {
          cmd: "frame",
          frame: frame,
          width: 640,
          height: 480,
        },
        [frame]
      );
    } catch (e) {}
    //capture in 1 second
    setTimeout(grab, 1000);
  };
  grab();

  pc = new RTCPeerConnection({ forceEncodedVideoInsertableStreams: true });

  var ws = new WebSocket(url, "insertable-face");

  pc.ontrack = (event) => {
    console.debug("onAddTrack", event);
    //Get the receiver streams for track
    const receiverStreams = event.receiver.createEncodedVideoStreams();
    //Transfer streams to worker
    worker.postMessage(
      {
        cmd: "extract",
        readableStream: receiverStreams.readableStream,
        writableStream: receiverStreams.writableStream,
      },
      [receiverStreams.readableStream, receiverStreams.writableStream]
    );
    addVideoForStream(event.streams[0]);
  };

  ws.onopen = async function () {
    console.log("opened");

    try {
      //Get video track
      const track = localStream.getTracks()[0];
      //Send it
      const sender = pc.addTrack(track);
      //Get insertable streams
      const senderStreams = sender.createEncodedVideoStreams();
      //Transfer streams to worker
      worker.postMessage(
        {
          cmd: "insert",
          readableStream: senderStreams.readableStream,
          writableStream: senderStreams.writableStream,
        },
        [senderStreams.readableStream, senderStreams.writableStream]
      );

      //Create offer
      const offer = await pc.createOffer();
      //Set it
      pc.setLocalDescription(offer);
      //Create room
      ws.send(
        JSON.stringify({
          cmd: "OFFER",
          offer: offer.sdp,
        })
      );
    } catch (error) {
      console.error("Error", error);
      alert(error);
    }
  };

  ws.onmessage = function (event) {
    console.log(event);

    //Get protocol message
    const msg = JSON.parse(event.data);

    console.log(msg.answer);
    pc.setRemoteDescription(
      new RTCSessionDescription({
        type: "answer",
        sdp: msg.answer,
      }),
      function () {
        console.log("JOINED");
      },
      function (err) {
        console.error("Error joining", err);
      }
    );
  };
}

var dialog = document.querySelector("dialog");
if (dialog.showModal) {
  dialog.showModal();
  dialog.querySelector(".ready").addEventListener("click", function () {
    local.play();
    dialog.close();
    connect();
  });
} else {
  connect();
}
