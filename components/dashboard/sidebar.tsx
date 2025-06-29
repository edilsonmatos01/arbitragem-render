'use client';

import Link from 'next/link';
import { useState } from 'react';
import ProfileImageUpload from './profile-image-upload';
import UserNav from './user-nav';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

interface User {
  name: string;
  imageUrl: string;
}

interface SidebarProps {
  user: User;
  navItems: NavItem[];
}

export default function Sidebar({ user, navItems }: SidebarProps) {
  const [currentImage, setCurrentImage] = useState(user.imageUrl);
  const activePath = "/dashboard"; 

  const handleImageChange = (newImage: string) => {
    setCurrentImage(newImage);
    // Aqui você pode implementar a lógica para salvar a nova imagem no servidor
  };

  return (
    <aside className="w-72 bg-dark-card p-6 flex flex-col text-gray-300 min-h-screen">
      <div className="flex flex-col items-center mb-12 pt-4">
        <ProfileImageUpload
          currentImage={currentImage}
          onImageChange={handleImageChange}
          userName="Arbitrack"
        />
      </div>
      <nav className="flex-1">
        <ul className="space-y-2 list-none">
          {navItems.map((item) => {
            const isActive = item.href === activePath;
            return (
              <li key={item.title}>
                <Link
                  href={item.href}
                  className={`flex items-center p-3 rounded-lg hover:bg-gray-700 hover:text-white transition-colors group ${
                    isActive ? 'bg-gray-700 text-custom-cyan' : 'text-gray-300'
                  }`}
                >
                  <span className={`mr-4 text-xl ${isActive ? 'text-custom-cyan' : 'text-gray-400 group-hover:text-white'}`}>
                    {item.icon}
                  </span>
                  <span className={`text-base font-medium ${isActive ? 'text-custom-cyan' : 'group-hover:text-white'}`}>
                    {item.title}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
              <UserNav 
          userName="Arbitrack"
          userImage="/images/avatar.png.png"
        />
      {/* Pode adicionar um rodapé à sidebar aqui, se necessário */}
    </aside>
  );
} 