export interface CommuterProfile {
  avatar: string;
  email: string;
  joinDate: string;
  name: string;
  phone: string;
  rating: number;
  totalRides: number;
  totalSpent: number;
}

export const commuterProfile: CommuterProfile = {
  name: "Juan Dela Cruz",
  email: "juan.delacruz@email.com",
  phone: "+63 917 123 4567",
  avatar: "/api/placeholder/100/100",
  joinDate: "January 2024",
  totalRides: 47,
  rating: 4.8,
  totalSpent: 3250,
};
