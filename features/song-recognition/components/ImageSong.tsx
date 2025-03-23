import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import Base64 from 'crypto-js/enc-base64';
import CryptoJS from 'crypto-js';

type Props = {
  trackId: string | null; // ID de la canción de Spotify
};

export const SPOTIFY_CLIENT_ID = '98abfcae43b14f3aa5b21288edf4034a'; 
export const SPOTIFY_CLIENT_SECRET = 'a12d8676a647443c96affcd0f9f0be1c';

export default function ImageSong({ trackId }: Props) {
  console.log('trackId: ' + trackId);
  const [imgSource, setImgSource] = useState<ImageSource | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrackImage = async () => {
      if (!trackId) {
        setError(null);
        setImgSource(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const accessToken = await getSpotifyAccessToken();
        const imageUrl = await getSpotifyTrackImage(trackId, accessToken);

        if (imageUrl) {
          setImgSource({ uri: imageUrl });
        } else {
          setError('No se encontró una imagen para esta canción.');
        }
      } catch (err) {
        setError('Error al obtener la imagen de la canción.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrackImage();
  }, [trackId]);

  const getSpotifyAccessToken = async (): Promise<string> => {
    const credentials = `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`;
    const encodedCredentials = Base64.stringify(CryptoJS.enc.Utf8.parse(credentials));

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encodedCredentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Error obteniendo el token de Spotify: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  };

  const getSpotifyTrackImage = async (trackId: string, accessToken: string): Promise<string | null> => {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error obteniendo los detalles de la canción: ${response.statusText}`);
    }

    const data = await response.json();
    return data.album.images[0]?.url || null; // La imagen de la canción está asociada al álbum
  };

  if (!trackId) {
    return null; // No renderizar nada si no hay trackId
  }

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {imgSource ? (
        <Image source={imgSource} style={styles.image} />
      ) : (
        <Text style={styles.errorText}>No hay imagen disponible.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  image: {
    width: 320,
    height: 440,
    borderRadius: 18,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    textAlign: 'center',
  },
});