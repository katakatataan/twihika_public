// import { SnapshotState } from '../../domain/eventStore/eventStoreRepository';
// import { Reducer } from '../../domain/eventStore/reducer';
// import * as AWS from 'aws-sdk'
// import { GetByIdOptions, EventStoreRepository } from '../../domain/eventStore/eventStoreRepository'
// import { Event } from '../../types/event'
// import { flat, getCurrentTime } from './util';
// import { DynamoDBNotFoundError, DynamoDBSaveConflictError, DynamoDBStateCountException, DynamoDBIdAndVersionCountException, InvalidStateFormatException } from './error';

// const emptyQueryRes: AWS.DynamoDB.DocumentClient.QueryOutput = {
//   Items: [],
//   Count: 0,
//   ScannedCount: 0
// }

// const esTable = process.env.EVENTSTORE_TABLE
// const SNAPSHOT_TABLE = process.env.EVENTSTORE_SNAPSHOT_TABLE
// const MAX_EVENTS_UNTIL_SAVED = 10
// const FROM_BEGGINNING_VERSION = 0;

// // https://www.serverless.com/framework/docs/providers/aws/cli-reference/invoke-local/
// // IS_LOCAL
// export const createDocument = () => process.env.IS_OFFLINE || process.env.IS_LOCAL ? new AWS.DynamoDB.DocumentClient({ region: 'localhost', endpoint: 'http://localhost:8000', })
//   : new AWS.DynamoDB.DocumentClient()

// export class DynamoDbEventStoreRepository implements EventStoreRepository {
//   constructor(private readonly dynamoClient: AWS.DynamoDB.DocumentClient) {
//     this.dynamoClient = dynamoClient
//   }
//   async getById(id: string, options: GetByIdOptions = {}): Promise<Event[]> {
//     if (!id) {
//       throw new Error(`undefined "id" param in getById()`)
//     }
//     const res = await queryRecursive(this.dynamoClient)({
//       TableName: esTable,
//       ConsistentRead: true,
//       KeyConditionExpression: 'resourceId = :a AND version >= :v',
//       ExpressionAttributeValues: {
//         ':a': id,
//         ':v': options?.version || 0
//       }
//     })

//     if (res.Count === 0) {
//       if (options?.returnArrayIfNoRecord) {
//         return []
//       }
//       throw new DynamoDBNotFoundError('resource not found');
//     }
//     // id??????????????????version????????????????????????ID???????????????option???????????????????????????version???????????????????????????
//     return flat(res.Items.map(item => JSON.parse(item.events)))
//   }

//   async getByIdUsingSnapshot({ resourceId, reducerId, reducerVersion, reducer }: { resourceId: string, reducerId: string, reducerVersion: number, reducer: Reducer }): Promise<SnapshotState> {
//     const snapshotId = `${reducerId}:${reducerVersion}`
//     const snapshotState = await this.dynamoClient
//       .query({
//         TableName: SNAPSHOT_TABLE,
//         KeyConditionExpression:
//           'resourceId = :resourceId AND begins_with(snapshotId, :snapshotId)',
//         ExpressionAttributeValues: {
//           ':resourceId': resourceId, // ?????????resource id linkid??????userid??????
//           ':snapshotId': snapshotId // ??????????????????readmodel????????????????????????????????????????????????????????????????????? from version????????????????????????????????????????????????reducerVersion????????????fromversion????????????????????????
//         }
//       })
//       .promise()
//       .then(res => {
//         if (res.Count > 1) {
//           throw new DynamoDBStateCountException('state count shoud under 2')
//         }
//         if (res.Count === 1) {
//           // 1?????????????????????????????????snapshot????????????????????????????????????????????????????????????resourceId???snaphostId???????????????????????????????????????
//           if (!res.Items[0]?.state || !res.Items[0]?.version) {
//             throw new InvalidStateFormatException(`res.Items[0].state: ${res.Items[0].state}`);
//           }
//           return {
//             state: JSON.parse(res.Items[0].state) as any,
//             version: res.Items[0].version as number
//           }
//         }
//         // 0???????????????????????????????????????????????????getById???version????????????????????????????????????????????????version????????????????????????
//         return {
//           version: FROM_BEGGINNING_VERSION
//         }
//       })

//     const snapshottedVersion = snapshotState.version ? snapshotState.version : snapshotState.version === FROM_BEGGINNING_VERSION ? FROM_BEGGINNING_VERSION : undefined;
//     const eventsStreamsNotSnapshoted = await this.getById(resourceId, {
//       returnArrayIfNoRecord: true,
//       version: snapshottedVersion // 0?????????0???????????????
//     })
//     // ??????????????????????????? + 1??????
//     const currentState: SnapshotState = {
//       state: reducer(eventsStreamsNotSnapshoted, snapshotState.state),
//       version: snapshotState.version + eventsStreamsNotSnapshoted.length // version???increment
//     }
//     if (!snapshottedVersion && eventsStreamsNotSnapshoted.length === 0) {
//       // return empty ????????????????????????????????????????????????
//       return {
//         state: undefined,
//         version: FROM_BEGGINNING_VERSION
//       }
//     }

//     if (
//       currentState.version - snapshotState.version >
//       MAX_EVENTS_UNTIL_SAVED
//     ) {
//       // resouceId????????????snapshot????????????????????????
//       await this.dynamoClient
//         .put({
//           TableName: SNAPSHOT_TABLE,
//           Item: {
//             resourceId: resourceId,
//             snapshotId: snapshotId,
//             version: currentState.version,
//             state: JSON.stringify(currentState.state)
//           },
//           ReturnValues: 'NONE'
//         })
//         .promise()
//     }
//     // no need to update snapshot
//     return currentState
//   }

//   getByIdAndVersion(
//     id: string,
//     version: number,
//     consistentRead = true
//   ): Promise<Event[]> {
//     return queryRecursive(this.dynamoClient)({
//       TableName: esTable,
//       ConsistentRead: consistentRead,
//       KeyConditionExpression: 'resourceId = :a AND version = :v',
//       ExpressionAttributeValues: {
//         ':a': id,
//         ':v': version
//       }
//     }).then(res => {
//       if (res.Count > 1) {
//         throw new DynamoDBIdAndVersionCountException('stream should under 2');
//       }
//       if (res.Count === 0) {
//         throw new DynamoDBNotFoundError('resource not found');
//       }
//       return JSON.parse(res.Items[0].events).map(e => {
//         return {
//           ...e,
//           committedAt: e?.committedAt ? e.committedAt : res.Items[0].events.committedAt
//         }
//       })
//     })
//   }

//   async save(params: {
//     events: Event[]
//     resourceId: string
//     expectedVersion: number
//   }) {
//     const currentTime = await getCurrentTime();

//     const eventsWithTimestamp = params.events
//       .filter(e => !!e)
//       .map(e => ({
//         ...e,
//         timestamp: e.timestamp || currentTime
//       }))

//     try {
//       const item = {
//         commitId: currentTime + ':' + params.resourceId,
//         committedAt: currentTime,
//         resourceId: params.resourceId,
//         version: params.expectedVersion,
//         events: JSON.stringify(eventsWithTimestamp)
//       };
//       console.log(item);
//       await this.dynamoClient
//         .put({
//           TableName: esTable,
//           Item: {
//             commitId: currentTime + ':' + params.resourceId,
//             committedAt: currentTime,
//             resourceId: params.resourceId,
//             version: params.expectedVersion,
//             events: JSON.stringify(eventsWithTimestamp)
//           },
//           // ConditionExpression put???????????????????????????????????? version???????????????????????????????????????
//           ConditionExpression: 'attribute_not_exists(version)',
//           // ????????????????????????????????????????????????????????????????????????????????????
//           ReturnValues: 'NONE'
//         })
//         .promise()
//       return {
//         id: params.resourceId
//       }
//     } catch (err) {
//       if (err.name === 'ConditionalCheckFailedException') {
//         throw new DynamoDBSaveConflictError('A commit already exists with the specified version');
//       }
//       // unexpected error handling as 500 status code
//       throw err
//     }
//   }
// }

// // limit????????????pagination??????????????????
// const queryRecursive = (dynamoClient: AWS.DynamoDB.DocumentClient) => (
//   params: AWS.DynamoDB.DocumentClient.QueryInput,
//   allResults: AWS.DynamoDB.DocumentClient.QueryOutput = emptyQueryRes
// ): Promise<AWS.DynamoDB.DocumentClient.QueryOutput> => {
//   return dynamoClient
//     .query(params)
//     .promise()
//     .then(res => {
//       allResults = {
//         ...allResults,
//         Items: [...allResults.Items, ...res.Items],
//         Count: allResults.Count + res.Count,
//         ScannedCount: allResults.ScannedCount + res.ScannedCount
//       }
//       if (res.LastEvaluatedKey) {
//         return queryRecursive(dynamoClient)(
//           {
//             ...params,
//             ExclusiveStartKey: res.LastEvaluatedKey
//           },
//           allResults
//         )
//       }
//       return allResults
//     })
//     .then(res => {
//       return res
//     })
// }