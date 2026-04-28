export interface OperatorProfile {
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  plate: string;
  region: string;
  rating: number;
  earnings: number;
  ridesToday: number;
  id: string;
}

export const operatorProfile: OperatorProfile = {
  name: "Rodel Mercado",
  email: "rodel.mercado@hatud.app",
  phone: "+63 912 345 6789",
  vehicle: "Toyota Veloz",
  plate: "NJU 1245",
  region: "Antique, PH",
  rating: 4.9,
  earnings: 8400,
  ridesToday: 27,
  id: "OP-1458",
};
