

export interface Event {
  coverImage: string;
  name: string;
  abstract: string;
  description: string;
  gallery: string[];
  dimensions: {
    height: number,
    width: number
  }
  eventDate?: string;
  location?: string;
  isUpcoming?: boolean;
}

export interface Project {
  coverImage: string;
  name: string;
  abstract: string;
  description: string;
  gallery: string[];
  dimensions: {
    height: number,
    width: number
  }
  shortkey:string;
  techStack?: string[];
  year?: string;
  competition?: string;
}

export interface Achievement {
  coverImage: string;
  name: string;
  abstract: string;
  description: string;
  gallery: string[];
  dimensions1:{
    height:number,
    width:number
  }
  achievementDate?: string;
  competition?: string;
  rank?: string;
}
