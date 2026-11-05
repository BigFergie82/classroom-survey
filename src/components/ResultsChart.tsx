import {BarChart,Bar,ResponsiveContainer,XAxis,YAxis,Tooltip} from 'recharts';
export default function ResultsChart({stats}:{stats:{choice_text:string;count:number}[]}){
 return <div className="result-chart" aria-hidden="true"><ResponsiveContainer width="100%" height={Math.max(150,stats.length*45)}><BarChart data={stats} layout="vertical" margin={{left:10,right:30}}><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="choice_text" width={140} tick={{fontSize:12}}/><Tooltip/><Bar dataKey="count" name="Responses" fill="#216550" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div>;
}
