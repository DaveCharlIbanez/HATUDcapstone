export interface OperatorProfile {
  earnings: number;
  email: string;
  id: string;
  name: string;
  phone: string;
  plate: string;
  rating: number;
  region: string;
  ridesToday: number;
  vehicle: string;
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
