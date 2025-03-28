import React from "react";
import { StyleSheet, Button, View, Text } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import hmacSHA1 from "crypto-js/hmac-sha1";
import Base64 from 'crypto-js/enc-base64';
import CryptoJS from 'crypto-js';
import ImageSong, {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
} from "@/features/song-recognition/components/ImageSong";

type MusicRecTestProps = {};
type MusicRecTestState = {
  response: string;
  artist: string;
  song: string;
  trackId: string | null;
};

export default class MusicRec_Test extends React.Component<
  MusicRecTestProps,
  MusicRecTestState
> {
  constructor(props: MusicRecTestProps) {
    super(props);
    this.state = { response: "", artist: "", song: "", trackId: null };
  }

  async _findSong() {
    const { status } = await Audio.requestPermissionsAsync();
    console.log("Current Status " + status);
    const recording = new Audio.Recording();
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: true,
      });

      const recordOptions = {
        android: {
          extension: ".m4a",
          outputFormat: 2, // MPEG_4
          audioEncoder: 3, // AAC
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: ".wav",
          audioQuality: 127, // High quality
          sampleRate: 8000,
          numberOfChannels: 1,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: true,
          bitRate: 128000, // Agregado para cumplir con RecordingOptionsIOS
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      };

      await recording.prepareToRecordAsync(recordOptions);
      await recording.startAsync();
      console.log("Recording");
      await timeout(3000);
      console.log("Done recording");
      await recording.stopAndUnloadAsync();
      let recordingFile = recording.getURI();

      let result = await identify(recordingFile!, defaultOptions);
      console.log(result);

      // Parsear la respuesta
      const parsedResult = JSON.parse(result);
      if (
        parsedResult.status.code === 0 &&
        parsedResult.metadata &&
        parsedResult.metadata.music &&
        parsedResult.metadata.music.length > 0
      ) {
        const song = parsedResult.metadata.music[0].title;
        const artist = parsedResult.metadata.music[0].artists[0].name;

        // Verifica si hay un trackId de Spotify
        let trackId =
          parsedResult.metadata.music[0].external_metadata?.spotify?.track
            ?.id || null;

        if (!trackId) {
          console.log(
            "No se encontró un trackId de Spotify. Buscando en Spotify..."
          );
          trackId = await this.searchSpotifyTrack(song, artist); // Realiza la búsqueda en Spotify
        }

        if (trackId) {
          console.log(`Spotify trackId encontrado: ${trackId}`);
        } else {
          console.log("No se pudo encontrar el trackId en Spotify.");
        }

        this.setState({ song, artist, trackId }); // Actualiza el estado con trackId (o null si no existe)
      } else {
        this.setState({
          song: "No se pudo identificar",
          artist: "",
          trackId: null,
        });
      }
    } catch (error) {
      console.log(error);
      this.setState({
        song: "Error al identificar",
        artist: "",
        trackId: null,
      });
    }
  }
  async searchSpotifyTrack(
    song: string,
    artist: string
  ): Promise<string | null> {
    try {
      const accessToken = await this.getSpotifyAccessToken();

      const query = encodeURIComponent(`${song} ${artist}`);
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Error buscando la canción en Spotify: ${response.statusText}`
        );
      }

      const data = await response.json();
      if (data.tracks.items.length > 0) {
        return data.tracks.items[0].id; // Devuelve el trackId de la primera coincidencia
      }

      return null; // No se encontró ninguna coincidencia
    } catch (error) {
      console.error("Error buscando la canción en Spotify:", error);
      return null;
    }
  }

  async getSpotifyAccessToken(): Promise<string> {
    const credentials = `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`;
    const encodedCredentials = Base64.stringify(
      CryptoJS.enc.Utf8.parse(credentials)
    );

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${encodedCredentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new Error(
        `Error obteniendo el token de Spotify: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.access_token;
  }
  render() {
    return (
      <View style={styles.container}>
        <Button title="Find Song" onPress={() => this._findSong()} />
        <Text style={styles.text}>Canción: {this.state.song}</Text>
        <Text style={styles.text}>Artista: {this.state.artist}</Text>
        <ImageSong trackId={this.state.trackId} />
      </View>
    );
  }
}

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const defaultOptions = {
  host: "identify-us-west-2.acrcloud.com",
  endpoint: "/v1/identify",
  signature_version: "1",
  data_type: "audio",
  secure: true,
  access_key: "ccdee699a8f78f3d4bb84848a59a50d9",
  access_secret: "kCYBGBxi342lA5FvcG85deUn0Y0py0OwLkTzCwF6",
};

function buildStringToSign(
  method: string,
  uri: string,
  accessKey: string,
  dataType: string,
  signatureVersion: string,
  timestamp: number
): string {
  return [method, uri, accessKey, dataType, signatureVersion, timestamp].join(
    "\n"
  );
}

function signString(stringToSign: string, accessSecret: string): string {
  return Base64.stringify(hmacSHA1(stringToSign, accessSecret));
}

async function identify(
  uri: string,
  options: typeof defaultOptions
): Promise<string> {
  const current_data = new Date();
  const timestamp = Math.floor(current_data.getTime() / 1000);
  const stringToSign = buildStringToSign(
    "POST",
    options.endpoint,
    options.access_key,
    options.data_type,
    options.signature_version,
    timestamp
  );

  const fileinfo = await FileSystem.getInfoAsync(uri, { size: true });
  if (!fileinfo.exists) {
    throw new Error("El archivo no existe.");
  }

  const signature = signString(stringToSign, options.access_secret);
  const formData: Record<string, any> = {
    sample: { uri: uri, name: "sample.wav", type: "audio/wav" },
    access_key: options.access_key,
    data_type: options.data_type,
    signature_version: options.signature_version,
    signature: signature,
    sample_bytes: fileinfo.size,
    timestamp: timestamp,
  };

  const form = new FormData();
  for (let key in formData) {
    form.append(key, formData[key]);
  }

  const postOptions = {
    method: "POST",
    headers: {
      "Content-Type": "multipart/form-data",
    },
    body: form,
  };

  const response = await fetch(
    "http://" + options.host + options.endpoint,
    postOptions
  );
  return await response.text();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    marginTop: 10,
    fontSize: 16,
  },
});
