import {Protofy} from 'protolib/base'
import pm2Api, { DeleteProcess, IntervalMqtt, GetProcesses, GetConsole, StartProcess, RestartProcess, StopProcess } from "./pm2";
import serviceApi from "./service";

const autoApis = Protofy("apis", {
    pm2: pm2Api,
    service: serviceApi
})

export default (app, context) => {
    Object.keys(autoApis).forEach((k) => {
        autoApis[k](app, context)
    })
    DeleteProcess(app),
    IntervalMqtt(app, context),
    GetProcesses(app, context),
    GetConsole(app, context),
    StartProcess(app),
    RestartProcess(app),
    StopProcess(app)
}