import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { EmptyState, PremiumCard, ScreenHeader, useClientColors } from '../../components/ClientUI';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';
import { formatDateTime } from '../../utils/format';

type LedgerEntry = { id:string; points_delta:number; balance_after:number; event_type:string; description:string; metadata:Record<string,unknown>|null; created_at:string };
const labels:Record<string,string>={opening_balance:'Bilanci fillestar',visit_earned:'Vizitë në sallon',order_earned:'Porosi produktesh',reward_spent:'Shpërblim i përdorur',manual_adjustment:'Korrigjim'};

export default function PointsHistoryScreen(){
  const Colors=useClientColors(); const {user,profile}=useAuth(); const [entries,setEntries]=useState<LedgerEntry[]>([]); const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false); const [error,setError]=useState('');
  const load=useCallback(async()=>{if(!user?.id)return;setError('');const{data,error:queryError}=await supabase.from('fresh_points_ledger').select('id,points_delta,balance_after,event_type,description,metadata,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(200);if(queryError)setError(queryError.message);else setEntries(data??[]);setLoading(false)},[user?.id]);
  useEffect(()=>{void load()},[load]);
  const refresh=async()=>{setRefreshing(true);await load();setRefreshing(false)};
  return <ScrollView style={{backgroundColor:Colors.background}} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary}/>}>
    <Pressable style={styles.back} onPress={()=>router.back()}><Ionicons name="chevron-back" size={22} color={Colors.text}/><Text style={{color:Colors.text,fontWeight:'800'}}>Profili</Text></Pressable>
    <ScreenHeader eyebrow="Besnikëria" title="Historiku i Fresh Points" subtitle="Shikoni si i keni fituar dhe përdorur pikët tuaja."/>
    <View style={[styles.balance,{backgroundColor:Colors.primary}]}><Text style={{color:Colors.onPrimary,opacity:.8}}>Bilanci aktual</Text><Text style={[styles.balancePoints,{color:Colors.onPrimary}]}>{profile?.points??0} pikë</Text><Text style={{color:Colors.onPrimary,fontWeight:'700'}}>{((profile?.points??0)/10).toFixed(2)} €</Text></View>
    {loading?<ActivityIndicator color={Colors.primary} style={{marginTop:30}}/>:error?<PremiumCard><EmptyState icon="cloud-offline-outline" title="Historiku nuk u ngarkua" message={error}/></PremiumCard>:entries.length===0?<PremiumCard><EmptyState icon="time-outline" title="Nuk ka lëvizje ende" message="Fitimet dhe përdorimet e ardhshme do të shfaqen këtu."/></PremiumCard>:<View style={{gap:10}}>{entries.map(entry=>{const earned=entry.points_delta>0;return <PremiumCard key={entry.id} style={styles.entry}><View style={[styles.icon,{backgroundColor:earned?`${Colors.success}18`:`${Colors.danger}18`}]}><Ionicons name={earned?'add':'remove'} size={20} color={earned?Colors.success:Colors.danger}/></View><View style={{flex:1}}><Text style={{color:Colors.text,fontWeight:'800'}}>{labels[entry.event_type]||entry.description}</Text><Text style={{color:Colors.muted,fontSize:12,marginTop:3}}>{entry.description}</Text><Text style={{color:Colors.muted,fontSize:11,marginTop:4}}>{formatDateTime(entry.created_at)} · Bilanci: {entry.balance_after}</Text></View><Text style={{color:earned?Colors.success:Colors.danger,fontWeight:'900',fontSize:16}}>{earned?'+':''}{entry.points_delta}</Text></PremiumCard>})}</View>}
  </ScrollView>;
}
const styles=StyleSheet.create({content:{paddingHorizontal:22,paddingTop:20,paddingBottom:120},back:{flexDirection:'row',alignItems:'center',marginBottom:18},balance:{borderRadius:22,padding:20,marginBottom:18},balancePoints:{fontSize:30,fontWeight:'900',marginTop:4},entry:{flexDirection:'row',alignItems:'center',gap:12,padding:14},icon:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center'}});
