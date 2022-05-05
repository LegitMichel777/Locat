// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()

// 云函数入口函数
exports.main = async (event, context) => {
    // returns a object with a result field saying "error", "false", "true"
    const wxContext = cloud.getWXContext()
    let userId = wxContext.OPENID;

    console.log(`Checking if user has submitted for user ID ${userId}`);

    let db = cloud.database();

    let findUserResponsesRequest = await db.collection("Responses").where({
        _openid: userId,
    }).get();

    if (findUserResponsesRequest.errMsg !== "collection.get:ok") {
        return {
            result: "error"
        };
    }

    return {
        result: (findUserResponsesRequest.data.length>0 ? "true" : "false")
    };
}