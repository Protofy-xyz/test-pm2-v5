import { z } from "protolib/base";
import { Protofy, AutoModel, Schema, BaseSchema } from 'protolib/base'
import moment from "moment";

Protofy("features", {
    "AutoAPI": true
})

export const BaseServiceSchema = Schema.object(Protofy("schema", {
	id: z.string(),
	status: z.string().defaultValue('stopped'),
	enabled: z.boolean()
}))

export const ServiceSchema = Schema.object({
    ...BaseSchema.shape,
    ...BaseServiceSchema.shape
});

export type ServiceType = z.infer<typeof ServiceSchema>;
export const ServiceModel = AutoModel.createDerived<ServiceType>("ServiceModel", ServiceSchema, 'services', '/api/v1/');