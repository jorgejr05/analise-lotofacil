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

      // Inicia gravando em fatias de 100ms para garantir fluxo de dados
      mediaRecorder.current.start(100);
      setIsRecording(true);
      console.log("[useAudioRecorder] Gravação iniciada");
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
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        
        mediaRecorder.current?.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      mediaRecorder.current.stop();
    });
  };

  return { isRecording, startRecording, stopRecording };
};