export interface BaseResource {
  id: string;
}

export interface TimedResource extends BaseResource {
  createdAt: Date;
  updatedAt: Date;
}
