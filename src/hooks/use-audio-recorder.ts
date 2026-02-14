"use client";

import { useState, useRef } from 'react';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Detecção de tipo de mídia suportado
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';

      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      chunks.current = [];

      mediaRecorder.current.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      console.log("[useAudioRecorder] Gravação iniciada com", mimeType);
    } catch (err) {
      console.error("[useAudioRecorder] Erro ao acessar microfone:", err);
    }
  };

  const stopRecording = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!mediaRecorder.current || mediaRecorder.current.state === 'inactive') {
        return resolve("");
      }

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: mediaRecorder.current?.mimeType || 'audio/webm' });
        
        // Converter Blob para Base64 de forma robusta
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        
        // Fechar todas as faixas do stream para liberar o hardware
        mediaRecorder.current?.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        console.log("[useAudioRecorder] Gravação finalizada");
      };

      mediaRecorder.current.stop();
    });
  };

  return { isRecording, startRecording, stopRecording };
};