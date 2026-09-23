export function micConstraints(): MediaTrackConstraints {
  return {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
  };
}

export function micAudioConstraints(): MediaStreamConstraints {
  return { audio: micConstraints(), video: false };
}

export function relaxedMicAudioConstraints(): MediaStreamConstraints {
  return { audio: true, video: false };
}

export async function requestMicStream(
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
): Promise<MediaStream> {
  try {
    return await getUserMedia(micAudioConstraints());
  } catch {
    return await getUserMedia(relaxedMicAudioConstraints());
  }
}
