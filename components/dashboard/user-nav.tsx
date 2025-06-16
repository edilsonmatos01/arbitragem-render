import Image from 'next/image';

interface UserNavProps {
  userName: string;
  userImage: string;
}

export default function UserNav({ userName, userImage }: UserNavProps) {
  return (
    <div className="flex items-center space-x-4 p-4">
      <div className="relative h-10 w-10">
        <Image
          src={userImage}
          alt={`${userName}'s profile`}
          className="rounded-full"
          fill
          sizes="40px"
        />
      </div>
      <div>
        <p className="text-sm font-medium">{userName}</p>
      </div>
    </div>
  );
} 