import { Mongo } from 'meteor/mongo';

export const AuditLogs = new Mongo.Collection('auditlogs');
