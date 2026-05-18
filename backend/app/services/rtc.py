import asyncio
from fractions import Fraction


class RtcUnavailableError(RuntimeError):
    pass


async def create_rtc_answer(sdp: str, offer_type: str) -> dict[str, str]:
    try:
        from aiortc import RTCPeerConnection, RTCSessionDescription
        from aiortc.contrib.media import MediaBlackhole
        from av import AudioFrame
        from aiortc import AudioStreamTrack
    except Exception as exc:
        raise RtcUnavailableError("aiortc is not installed") from exc

    class SilenceAudioTrack(AudioStreamTrack):
        kind = "audio"

        def __init__(self) -> None:
            super().__init__()
            self.samples = 960
            self.sample_rate = 48000
            self.pts = 0

        async def recv(self):
            await asyncio.sleep(self.samples / self.sample_rate)
            frame = AudioFrame(format="s16", layout="mono", samples=self.samples)
            frame.planes[0].update(bytes(self.samples * 2))
            frame.pts = self.pts
            frame.sample_rate = self.sample_rate
            frame.time_base = Fraction(1, self.sample_rate)
            self.pts += self.samples
            return frame

    pc = RTCPeerConnection()
    recorder = MediaBlackhole()

    @pc.on("track")
    async def on_track(track):
        recorder.addTrack(track)
        await recorder.start()

        @track.on("ended")
        async def on_ended():
            await recorder.stop()
            await pc.close()

    pc.addTrack(SilenceAudioTrack())
    await pc.setRemoteDescription(RTCSessionDescription(sdp=sdp, type=offer_type))
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    return {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
