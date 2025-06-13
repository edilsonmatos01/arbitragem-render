'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProfileImageUploadProps {
  currentImage: string;
  onImageChange: (newImage: string) => void;
  userName: string;
}

export default function ProfileImageUpload({ currentImage, onImageChange, userName }: ProfileImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState(currentImage);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Criar URL temporária para preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      
      // Aqui você implementaria a lógica de upload do arquivo
      // Por enquanto, vamos apenas simular atualizando o preview
      onImageChange(objectUrl);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative group">
        <Image
          src={previewUrl}
          alt="Foto de perfil"
          width={100}
          height={100}
          className="rounded-full border-2 border-custom-cyan shadow-[0_0_15px_rgba(0,196,159,0.3)]"
        />
        <label
          htmlFor="profile-image-upload"
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
        >
          <span className="text-white text-xs">Alterar foto</span>
        </label>
        <input
          id="profile-image-upload"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="hidden"
        />
      </div>
      <span className="text-white font-medium text-lg mt-3">{userName}</span>
    </div>
  );
} 