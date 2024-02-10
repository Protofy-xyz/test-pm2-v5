/* @my/ui is wrapper for tamagui. Any component in tamagui can be imported through @my/ui
use result = await API.get(url) or result = await API.post(url, data) to send requests
API.get/API.post will return a PendingResult, with properties like isLoaded, isError and a .data property with the result
if you call paginated apis, you will need to wait for result.isLoaded and look into result.data.items, since result.data is an object with the pagination.
Paginated apis return an object like: {"itemsPerPage": 25, "items": [...], "total": 20, "page": 0, "pages": 1}
*/

import { Protofy, z } from 'protolib/base'
import { Objects } from 'app/bundles/objects'
import { XStack, Paragraph } from "@my/ui"
import { DataView, DataTable2, API, PaginatedDataSSR, SectionBox, SelectList } from "protolib"
import { ServiceButtons } from '../components/ServiceButtons'
import { ServiceStatus } from '../components/ServiceStatus'
import { useState, useEffect } from 'react';
import { useSubscription } from 'mqtt-react-hooks';
import { ServiceModel } from '../objects/service'
import { AdminPage } from 'protolib'
import { Save, HardHat } from '@tamagui/lucide-icons'
import React from 'react'

const isProtected = Protofy("protected", false)
const {name, prefix} = Objects.service.getApiOptions()
const sourceUrl = prefix + name

export function ListContainersPage({ initialElements, pageSession }) {
    const [elements, setElements] = useState(initialElements)
    const [consoleDataMessage, setConsoleDataMessage] = useState([]);
    const [visible, setVisible] = useState<boolean>(false)
    const [minersData, setMinersData] = useState([]);
    const [pageLoaded, setPageLoaded] = useState(false);
    const [save, setSave] = useState()
    const stopped = ["stopped"]

    const  onPress =  () => {
        setVisible(!visible)  
        if(!visible) {
            setConsoleDataMessage([])
        }     
    }
    const fetchInitialData = async () => {
        try {
            const updatedMinersData = await Promise.all(
            elements.data.items?.map(async (minero) => {
                const response = await API.get(`/api/v1/pm2Services/describe/${minero.id}`);
                const data = response.data;
                const cpu = data.cpu          
                const memory = data.memory
                let updatedMinero;
                if (minero.status==='online' && !minero.enabled && minero.id) {
                    updatedMinero = {
                        id: minero.id,
                        status: 'stopped',
                        cpu: 0,
                        memory: '0.0', 
                        enabled: minero.enabled,
                    };
                    API.get('/api/v1/pm2Services/stop/' + minero.id)  
                    setPageLoaded(true)
                } else {
                    if (minero.status === 'online' && !pageLoaded) {
                        console.log("entro")
                        updatedMinero = {
                            id: minero.id,
                            status: minero.status,
                            cpu: !isNaN(cpu) ? cpu : 'N/A',
                            memory: !isNaN(memory) ? memory : 'N/A', 
                            enabled: minero.enabled,
                        };
                        API.get('/api/v1/pm2Services/start/' + minero.id)  
                        setPageLoaded(false)
                    } else {
                        updatedMinero = {
                            id: minero.id,
                            status: minero.status,
                            cpu: !isNaN(cpu) ? cpu : 'N/A',
                            memory: !isNaN(memory) ? memory : 'N/A', 
                            enabled: minero.enabled,
                        };
                        setPageLoaded(false)
                    }
                }
                
                return updatedMinero;
            })
            );
            setMinersData(updatedMinersData);
        } catch (error) {
            console.error('Error getting data from miners:', error);
        }
    };

    const serviceMqttData = (realTimeData) => {
        if (!pageLoaded) {
            const realTime = JSON.parse(realTimeData);
            try {
                setMinersData(prev => {
                    const idExists = prev.some((minero) => minero.id === realTime.id);
                    if (!idExists) {
                        return [...prev, realTime];
                    }
        
                    return prev.map((minero) => {
                        if (minero.id === realTime.id) {
                            return {
                                ...minero,
                                cpu: realTime?.cpu,
                                memory: realTime?.memory + ' MB',
                                status: realTime?.status,
                            };
                        }
                        return minero;
                    });
                });
            } catch (error) {
                console.error('Error when making the request to the server:', error);
            }
        }
    };
    
    
      
    const realTimeDataTopic = 'real_time_data_topic';
    const { message: realTimeDataMessage } = useSubscription(realTimeDataTopic);
    const consoleDataTopic = 'console_data';
    const { message } = useSubscription(consoleDataTopic);
    useEffect(() => {
        if (message && !consoleDataMessage.includes(message.message)) {
            console.log("file content: ", message.message)
            setConsoleDataMessage(prevMessages => [...prevMessages, message.message]);
        }
    }, [message]);
    const pageState = {
        itemsPerPage: '',
        page: '',
        search: '',
        orderBy: '',
        orderDirection: '',
        view: '',
        item: '',
        editFile: ''
    }
    const typeArray = [{status:'stopped'}]
    return (<AdminPage title="Services" pageSession={pageSession}>
        {visible ? (
            <SectionBox mt="$5" width={'1100px'} color="yellow" bubble={true} gradient={true} borderColor={'yellow'} borderStyle="solid">
            {consoleDataMessage.map((message, index) => (
                <Paragraph key={index}>{message}</Paragraph>
            ))}
            </SectionBox>
        ) : null}
        <DataView
            integratedChat
            rowIcon={HardHat}
            sourceUrl={sourceUrl}
            initialItems={initialElements}
            itemData={initialElements}
            numColumnsForm={1}
            name="service"
            onAdd={data=> {return data}}
            columns={DataTable2.columns(
                DataTable2.column("id", "id", true),
                DataTable2.column("status", "status", true, (row) => {
                    useEffect(() => {
                        fetchInitialData();
                    }, [elements])
                    useEffect(() => {
                        if (realTimeDataMessage) {
                            try {
                                row = serviceMqttData(realTimeDataMessage.message);  
                            } catch (error) {
                                console.error('Error parsing MQTT message:', error);
                            }
                        }
                    }, [realTimeDataMessage, pageLoaded]);
                    return <ServiceStatus status={row.status} />;
                }),
                DataTable2.column("monit", "monit", false, (row) => {        
                    useEffect(() => {
                        fetchInitialData();
                    }, [elements]);
                
                    useEffect(() => {
                        if (realTimeDataMessage) {
                            try {
                                serviceMqttData(realTimeDataMessage.message);  
                            } catch (error) {
                                console.error('Error parsing MQTT message:', error);
                            }
                        }
                    }, [realTimeDataMessage, pageLoaded]);
                
                    return (
                        minersData?.map((minero) => (
                            <XStack key={minero.id}>
                            {minero.id === row.id && (
                                <>
                                    <XStack width={80} display='flex' alignItems='center'>
                                        <Paragraph>CPU: {minero.cpu} </Paragraph>
                                    </XStack>
                                    <XStack width={100} display='flex' alignItems='center'>
                                        <Paragraph>RAM: {minero.memory}</Paragraph>
                                    </XStack>
                                </>
                            )}
                            </XStack>
                        ))
                    );
                        
                }),
                DataTable2.column("buttons", "enabled", true, (row) => {
                    useEffect(() => {
                        const fetchData = async () => {
                            if (pageLoaded) {
                                try {
                                    row = await fetchInitialData();
                                } catch (error) {
                                    console.error('Error obtaining the inital data:', error);
                                }
                            }
                        };
                    
                        fetchData();
                    }, [pageLoaded]);
                    
                    useEffect(() => {
                        if (realTimeDataMessage) {
                            try {
                                row = serviceMqttData(realTimeDataMessage.message);
                            } catch (error) {
                                console.error('Error parsing MQTT message:', error);
                            }
                        }
                    }, [realTimeDataMessage]);
                    if (pageLoaded) {
                        row.enabled ? row.status : row.status = 'stopped'
                    }
                    
                    return (
                        <>
                            <ServiceButtons minero={row} onPress={onPress} />
                            
                        </>
                    );
                      
                }),
            )}
            extraMenuActions={[
                {
                    text: "Save all services",
                    icon: Save,
                    action: async () => { minersData?.map(async (minero) => {
                        if (minero.id) {
                            try {
                                let enabled = await API.get('/api/v1/services/' + minero.id);      
                                minero.enabled = true
                                await API.post('/api/v1/services/' + minero.id, minero);                   
                            } catch (error) {
                                console.error('Error when making the request to the server:', error);
                            }   
                        }
                        }) },
                    isVisible: () => true, 
                    menus: ["bulk"]
                }
            ]}
            extraFieldsForms={{
                status: z.union(stopped.map(o => z.literal(o))).after('id')
            }}

            model={ServiceModel}
            pageState={pageState}
            dataTableGridProps={{ itemMinWidth: 300, spacing: 20 }}
            dataTableListProps = {{onDelete: async (minero) => {
                var endpoint = minero;
                var parts = endpoint.split("/");
                var lastPart = parts[parts.length - 1];
                await API.get('/api/v1/pm2Services/delete/' + lastPart)
            }}}
        />    
    </AdminPage>);
}

export default {
    route: Protofy("route", "/services"),
    component: ({pageState, initialItems, pageSession, extraData}:any) => {
        return (
            <ListContainersPage initialElements={initialItems} pageSession={pageSession}/>
        )
    }, 
    getServerSideProps: PaginatedDataSSR(sourceUrl, isProtected?Protofy("permissions", []):undefined)
}
